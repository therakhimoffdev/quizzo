import Quiz from '../models/Quiz.js';
import Question from '../models/Question.js';
import Result from '../models/Result.js';
import User from '../models/User.js';
import mongoose from 'mongoose'; // 🔥 MUHIM: mongoose ni import qilish!

// =============== ADMIN UCHUN =====================

// Create a new quiz with questions
export const createQuiz = async (req, res) => {
    try {
        const {
            name,
            description,
            category,
            difficulty,
            timeLimit,
            color,
            isActive,
            questions
        } = req.body;

        // Validation
        if (!name || !description || !category || !timeLimit || !questions || questions.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Barcha majburiy maydonlarni to\'ldiring'
            });
        }

        // Admin borligi middleware orqali tekshirilgan
        if (!req.admin) {
            return res.status(401).json({
                success: false,
                message: 'Admin huquqlari talab qilinadi'
            });
        }

        // Create quiz
        const quiz = new Quiz({
            name,
            description,
            category,
            difficulty,
            timeLimit,
            color,
            isActive,
            totalQuestions: questions.length,
            createdBy: req.admin._id,
            createdByType: 'admin',
            rating: 4.8,
            playCount: 0
        });

        const savedQuiz = await quiz.save();

        // Create questions
        const questionPromises = questions.map((q) => {
            const question = new Question({
                quizId: savedQuiz._id,
                questionText: q.questionText,
                options: q.options.map(opt => ({
                    text: opt.text,
                    isCorrect: opt.isCorrect
                })),
                explanation: q.explanation || '',
                points: q.points || 10,
                timeLimit: q.timeLimit || 30
            });
            return question.save();
        });

        await Promise.all(questionPromises);

        res.status(201).json({
            success: true,
            message: 'Quiz muvaffaqiyatli yaratildi',
            data: {
                quizId: savedQuiz._id,
                name: savedQuiz.name,
                totalQuestions: savedQuiz.totalQuestions
            }
        });
    } catch (error) {
        console.error('Quiz yaratishda xatolik:', error);
        res.status(500).json({
            success: false,
            message: 'Quiz yaratishda xatolik',
            error: error.message
        });
    }
};

// Get quizzes created by current user (admin)
export const getMyQuizzes = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Avval tizimga kiring'
            });
        }

        const quizzes = await Quiz.find({ createdBy: req.user._id })
            .sort({ createdAt: -1 })
            .select('name description category difficulty timeLimit totalQuestions isActive playCount createdAt')
            .lean();

        res.json({
            success: true,
            data: quizzes
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Delete a quiz
export const deleteQuiz = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user is authenticated
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Avval tizimga kiring'
            });
        }

        // Find quiz
        const quiz = await Quiz.findById(id);

        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: 'Quiz topilmadi'
            });
        }

        // Check if user owns the quiz or is admin
        if (quiz.createdBy.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Bu quizni o\'chirish huquqingiz yo\'q'
            });
        }

        // Delete associated questions first
        await Question.deleteMany({ quizId: id });

        // Delete quiz
        await Quiz.findByIdAndDelete(id);

        res.json({
            success: true,
            message: 'Quiz muvaffaqiyatli o\'chirildi'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// =============== PUBLIC FUNCTIONS =====================

// Get all active quizzes
export const getAllQuizzes = async (req, res) => {
    try {
        const { userId } = req.query;

        // Get all active quizzes
        const quizzes = await Quiz.find({ isActive: true })
            .select('name description category timeLimit color rating totalQuestions playCount')
            .lean();

        // If userId is provided, check which quizzes the user has completed
        let completedQuizIds = [];
        if (userId) {
            const userResults = await Result.find({ userId })
                .select('quizId')
                .lean();
            completedQuizIds = userResults.map(result => result.quizId.toString());
        }

        // Transform data for frontend
        const transformedQuizzes = quizzes.map(quiz => ({
            _id: quiz._id,
            name: quiz.name,
            description: quiz.description,
            timeLimit: quiz.timeLimit,
            color: quiz.color,
            rating: quiz.rating,
            totalQuestions: quiz.totalQuestions,
            playCount: quiz.playCount,
            questions: new Array(quiz.totalQuestions || 0),
            isCompleted: completedQuizIds.includes(quiz._id.toString())
        }));

        res.json({
            success: true,
            data: transformedQuizzes
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Get completed quizzes
export const getCompletedQuizzes = async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'userId is required'
            });
        }

        // Get user's completed quiz results
        const results = await Result.find({ userId })
            .populate('quizId', 'name description category timeLimit color rating totalQuestions')
            .sort({ createdAt: -1 })
            .lean();

        // Filter out results without quiz data
        const completedQuizzes = results
            .filter(result => result.quizId)
            .map(result => ({
                ...result.quizId,
                resultId: result._id,
                completedAt: result.createdAt,
                score: result.score,
                correctAnswers: result.correctAnswers,
                totalQuestions: result.totalQuestions,
                isCompleted: true
            }));

        res.json({
            success: true,
            data: completedQuizzes
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Get quiz by ID with questions - FIXED VERSION
// Get quiz by ID with questions - IMPROVED VERSION
export const getQuizById = async (req, res) => {
    try {
        const { id } = req.params;

        console.log('🔍 Quiz ID from params:', id); // Debug log

        // Yumshatilgan validation
        if (!id || id === 'undefined' || id === 'null') {
            console.error('❌ Invalid quiz ID received:', id);
            return res.status(400).json({
                success: false,
                message: 'Quiz ID topilmadi yoki noto\'g\'ri',
                receivedId: id // Qaysi ID kelyotganini ko'rish uchun
            });
        }

        // Check if id is valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.warn('⚠️ Invalid ObjectId format:', id);
            // Faqat ogohlantirish, lekin baribir quizni izlashga urinib ko'ramiz
            // Chunki ba'zi ID lar ObjectId formatida bo'lmasligi mumkin
        }

        const quiz = await Quiz.findById(id);
        if (!quiz) {
            // Quiz topilmasa, barcha quizlarni ko'rib chiqamiz
            const allQuizzes = await Quiz.find({}).select('_id name').limit(5);
            console.log('📋 Available quizzes:', allQuizzes);

            return res.status(404).json({
                success: false,
                message: 'Quiz topilmadi',
                suggestion: 'Quizzes sahifasidan quiz tanlang',
                availableQuizzes: allQuizzes.map(q => ({ id: q._id, name: q.name }))
            });
        }

        // Increment play count
        quiz.playCount += 1;
        await quiz.save();

        // Get questions
        const questions = await Question.find({ quizId: id })
            .select('questionText options explanation points timeLimit')
            .lean();

        // Remove isCorrect field from options for security
        const secureQuestions = questions.map(q => ({
            ...q,
            options: q.options.map(opt => ({ text: opt.text }))
        }));

        console.log('✅ Quiz found:', quiz.name, 'Questions:', secureQuestions.length);

        res.json({
            success: true,
            data: {
                quiz,
                questions: secureQuestions
            }
        });
    } catch (error) {
        console.error('❌ GET QUIZ BY ID ERROR:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// Helper function for grade calculation
const calculateGrade = (correctCount, totalQuestions) => {
    const percentage = (correctCount / totalQuestions) * 100;

    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
};

// Submit quiz results - COMPLETE FIXED VERSION
export const submitQuiz = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { userId, quizId, answers, timeSpent } = req.body;

        // Validation
        if (!userId || !quizId || !answers || answers.length === 0) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Majburiy maydonlar yetishmayapti'
            });
        }

        // Check if quiz already completed
        const existingResult = await Result.findOne({ userId, quizId }).session(session);
        if (existingResult) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Bu quiz allaqachon yechilgan'
            });
        }

        // 1. Get questions
        const questions = await Question.find({ quizId }).session(session);

        if (!questions.length) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: 'Savollar topilmadi'
            });
        }

        // 2. Create question map
        const questionMap = new Map();
        questions.forEach(q => {
            questionMap.set(q._id.toString(), q);
        });

        let correctCount = 0;
        let totalScore = 0;
        const detailedAnswers = [];

        // 3. Check answers and calculate score
        for (const answer of answers) {
            const question = questionMap.get(answer.questionId);

            if (!question) {
                console.warn(`Question not found: ${answer.questionId}`);
                continue;
            }

            const selectedOption = question.options[answer.selectedOption];
            const isCorrect = selectedOption ? selectedOption.isCorrect : false;

            if (isCorrect) {
                correctCount++;
                totalScore += question.points || 10;
            }

            detailedAnswers.push({
                questionId: question._id,
                selectedOption: answer.selectedOption,
                isCorrect,
                timeTaken: answer.timeTaken || 0
            });
        }

        const wrongCount = questions.length - correctCount;

        // 4. Calculate coins and XP
        const coinsEarned = totalScore;
        const xpEarned = Math.floor(totalScore / 5);
        const bonusCoins = correctCount === questions.length ? Math.floor(coinsEarned * 0.2) : 0;
        const totalCoinsEarned = coinsEarned + bonusCoins;

        // 5. Create result
        const result = new Result({
            userId,
            quizId,
            score: totalScore,
            totalQuestions: questions.length,
            correctAnswers: correctCount,
            wrongAnswers: wrongCount,
            timeSpent: timeSpent || 0,
            answers: detailedAnswers,
            coinsEarned: totalCoinsEarned,
            xpEarned,
            bonusCoins,
            percentage: Math.round((correctCount / questions.length) * 100),
            grade: calculateGrade(correctCount, questions.length)
        });

        await result.save({ session });

        // 6. Update user
        const user = await User.findById(userId).session(session);
        if (user) {
            user.coins = (user.coins || 0) + totalCoinsEarned;
            user.xp = (user.xp || 0) + xpEarned;
            user.total_games = (user.total_games || 0) + 1;
            user.correct_answers = (user.correct_answers || 0) + correctCount;
            user.wrong_answers = (user.wrong_answers || 0) + wrongCount;

            // Calculate level
            const newLevel = Math.floor(user.xp / 1000) + 1;

            // Check if level increased
            const oldLevel = user.level || 1;
            user.level = newLevel;

            if (newLevel > oldLevel) {
                user.coins += 50; // Level up bonus
            }

            await user.save({ session });
        }

        // 7. Update quiz play count
        await Quiz.findByIdAndUpdate(
            quizId,
            { $inc: { playCount: 1 } },
            { session }
        );

        await session.commitTransaction();

        // 8. Response
        return res.json({
            success: true,
            data: {
                score: totalScore,
                correctAnswers: correctCount,
                wrongAnswers: wrongCount,
                totalQuestions: questions.length,
                coinsEarned: totalCoinsEarned,
                xpEarned,
                bonusCoins,
                timeSpent: timeSpent || 0,
                percentage: Math.round((correctCount / questions.length) * 100),
                grade: calculateGrade(correctCount, questions.length)
            }
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('SUBMIT QUIZ ERROR:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    } finally {
        session.endSession();
    }
};

// Get user's quiz history
export const getUserQuizHistory = async (req, res) => {
    try {
        const { userId } = req.params;

        const history = await Result.find({ userId })
            .populate('quizId', 'name category color')
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};