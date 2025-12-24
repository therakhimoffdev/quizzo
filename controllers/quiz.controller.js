import Quiz from '../models/Quiz.js';
import Question from '../models/Question.js';
import Result from '../models/Result.js';
import User from '../models/User.js';


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
            createdBy: req.admin._id, // Admin ID sini saqlaymiz
            createdByType: 'admin', // Admin tomonidan yaratilganligini belgilaymiz
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

// =============== ADMIN UCHUN TUGADI ==============================

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

// Get quiz by ID with questions
export const getQuizById = async (req, res) => {
    try {
        const { id } = req.params;

        const quiz = await Quiz.findById(id);
        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }

        // Increment play count
        quiz.playCount += 1;
        await quiz.save();

        // Get questions (without correct answers initially)
        const questions = await Question.find({ quizId: id })
            .select('questionText options explanation points timeLimit')
            .lean();

        // Remove isCorrect field from options for security
        const secureQuestions = questions.map(q => ({
            ...q,
            options: q.options.map(opt => ({ text: opt.text }))
        }));

        res.json({
            success: true,
            data: {
                quiz,
                questions: secureQuestions
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Submit quiz results
// Submit quiz results (FIXED VERSION)
export const submitQuiz = async (req, res) => {
    try {
        const { userId, quizId, answers, timeSpent } = req.body;

        if (!userId || !quizId || !answers || answers.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Majburiy maydonlar yetishmayapti'
            });
        }

        // ✅ ENDI TO‘G‘RI JOYDA
        const existingResult = await Result.findOne({ userId, quizId });
        if (existingResult) {
            return res.status(400).json({
                success: false,
                message: 'Bu quiz allaqachon yechilgan'
            });
        }

        const questions = await Question.find({ quizId });
        if (!questions.length) {
            return res.status(404).json({
                success: false,
                message: 'Savollar topilmadi'
            });
        }

        const questionMap = {};
        questions.forEach(q => {
            questionMap[q._id.toString()] = q;
        });

        let correctCount = 0;
        let totalScore = 0;
        const detailedAnswers = [];

        for (const answer of answers) {
            const question = questionMap[answer.questionId];
            if (!question) continue;

            const selectedOption = question.options[answer.selectedOption];
            const isCorrect = selectedOption ? selectedOption.isCorrect : false;

            if (isCorrect) {
                correctCount++;
                totalScore += question.points || 0;
            }

            detailedAnswers.push({
                questionId: question._id,
                selectedOption: answer.selectedOption,
                isCorrect,
                timeTaken: answer.timeTaken || 0
            });
        }

        const wrongCount = questions.length - correctCount;
        const coinsEarned = totalScore;
        const xpEarned = Math.floor(totalScore / 5);

        const result = new Result({
            userId,
            quizId,
            score: totalScore,
            totalQuestions: questions.length,
            correctAnswers: correctCount,
            wrongAnswers: wrongCount,
            timeSpent: timeSpent || 0,
            answers: detailedAnswers,
            coinsEarned,
            xpEarned
        });

        await result.save();

        const user = await User.findById(userId);
        if (user) {
            user.coins = (user.coins || 0) + coinsEarned;
            user.xp = (user.xp || 0) + xpEarned;
            user.level = Math.floor(user.xp / 1000) + 1;
            await user.save();
        }

        return res.json({
            success: true,
            data: {
                score: totalScore,
                correctAnswers: correctCount,
                totalQuestions: questions.length,
                coinsEarned,
                xpEarned
            }
        });

    } catch (error) {
        console.error('SUBMIT QUIZ ERROR:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
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