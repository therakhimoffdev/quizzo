import Quiz from '../models/Quiz.js';
import Question from '../models/Question.js';
import Result from '../models/Result.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

// =============== GET QUIZ BY ID - MUHIM FIX ===============
export const getQuizById = async (req, res) => {
    try {
        const { id } = req.params;

        console.log('🔍 Backendda kelgan ID:', id);

        // Validation
        if (!id || id === 'undefined' || id === 'null') {
            console.log('⚠️ ID undefined yoki null');
            return res.status(400).json({
                success: false,
                message: 'Quiz ID kiritilmagan',
                debug: { receivedId: id, type: typeof id }
            });
        }

        // ObjectId formatini tekshirish
        if (mongoose.Types.ObjectId.isValid(id)) {
            // Valid ObjectId
            const quiz = await Quiz.findById(id);

            if (!quiz) {
                return res.status(404).json({
                    success: false,
                    message: 'Quiz topilmadi (ObjectId)'
                });
            }

            // Savollarni olish
            const questions = await Question.find({ quizId: id })
                .select('questionText options explanation points timeLimit')
                .lean();

            // Optionlardan isCorrect ni olib tashlash
            const secureQuestions = questions.map(q => ({
                ...q,
                options: q.options.map(opt => ({ text: opt.text }))
            }));

            // PlayCount ni oshirish
            quiz.playCount = (quiz.playCount || 0) + 1;
            await quiz.save();

            return res.json({
                success: true,
                data: {
                    quiz,
                    questions: secureQuestions
                }
            });
        } else {
            // Agar ObjectId formatida bo'lmasa, boshqa usul bilan izlash
            console.log('⚠️ ID ObjectId formatida emas, boshqa usul bilan izlaymiz...');

            // String ID bo'lsa, Quiz modelda _id ni string sifatida solishtirish
            const quiz = await Quiz.findOne({ _id: id.toString() });

            if (!quiz) {
                return res.status(404).json({
                    success: false,
                    message: 'Quiz topilmadi (string ID)'
                });
            }

            // Savollarni olish
            const questions = await Question.find({ quizId: quiz._id })
                .select('questionText options explanation points timeLimit')
                .lean();

            const secureQuestions = questions.map(q => ({
                ...q,
                options: q.options.map(opt => ({ text: opt.text }))
            }));

            // PlayCount ni oshirish
            quiz.playCount = (quiz.playCount || 0) + 1;
            await quiz.save();

            return res.json({
                success: true,
                data: {
                    quiz,
                    questions: secureQuestions
                }
            });
        }

    } catch (error) {
        console.error('❌ GET QUIZ BY ID ERROR:', error);
        return res.status(500).json({
            success: false,
            message: 'Server xatosi',
            error: error.message
        });
    }
};

// =============== SUBMIT QUIZ - TO'LIQ VERSIYA ===============
export const submitQuiz = async (req, res) => {

    try {
        const { userId, quizId, answers, timeSpent } = req.body;

        console.log('📝 Submit quiz ma\'lumotlari:', { userId, quizId, answersCount: answers?.length });

        // Validation
        if (!userId || !quizId || !answers || answers.length === 0) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Barcha maydonlarni to\'ldiring'
            });
        }

        // Quiz allaqachon yechilganligini tekshirish
        const existingResult = await Result
            .findOne({ userId, quizId })
            .session(session);

        if (existingResult) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Bu quiz allaqachon yechilgan'
            });
        }

        // Savollarni olish
        const questions = await Question.find({ quizId });

        if (!questions.length) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: 'Bu quiz uchun savollar topilmadi'
            });
        }

        // Question map yaratish
        const questionMap = {};
        questions.forEach(q => {
            questionMap[q._id.toString()] = q;
        });

        let correctCount = 0;
        let totalScore = 0;
        const detailedAnswers = [];

        // Javoblarni tekshirish
        for (const answer of answers) {
            const question = questionMap[answer.questionId];

            if (!question) {
                console.warn(`Savol topilmadi: ${answer.questionId}`);
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

        // Coins va XP hisoblash
        const coinsEarned = totalScore;
        const xpEarned = Math.floor(totalScore / 5);
        const bonusCoins = correctCount === questions.length ? Math.floor(coinsEarned * 0.2) : 0;
        const totalCoinsEarned = coinsEarned + bonusCoins;

        // Result yaratish
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
            percentage: Math.round((correctCount / questions.length) * 100)
        });

        await result.save({ session });

        // User yangilash
        const user = await User.findById(userId).session(session);
        if (user) {
            user.coins = (user.coins || 0) + totalCoinsEarned;
            user.xp = (user.xp || 0) + xpEarned;
            user.total_games = (user.total_games || 0) + 1;
            user.correct_answers = (user.correct_answers || 0) + correctCount;
            user.wrong_answers = (user.wrong_answers || 0) + wrongCount;

            // Level hisoblash (har 1000 XP = 1 level)
            user.level = Math.floor(user.xp / 1000) + 1;

            await user.save({ session });
        }

        // Quiz playCount yangilash
        await Quiz.findByIdAndUpdate(
            quizId,
            { $inc: { playCount: 1 } },
            { session }
        );

        await session.commitTransaction();

        // Response
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
                percentage: Math.round((correctCount / questions.length) * 100)
            }
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('❌ SUBMIT QUIZ ERROR:', error);
        return res.status(500).json({
            success: false,
            message: 'Server xatosi',
            error: error.message
        });
    } finally {
        session.endSession();
    }
};

// =============== GET ALL QUIZZES ===============
export const getAllQuizzes = async (req, res) => {
    try {
        const { userId } = req.query;

        // Barcha faol quizlarni olish
        const quizzes = await Quiz.find({ isActive: true })
            .select('name description category timeLimit color difficulty rating totalQuestions playCount')
            .lean();

        // Agar userId berilgan bo'lsa, qaysi quizlar yechilganligini tekshirish
        let completedQuizIds = [];
        if (userId) {
            const userResults = await Result.find({ userId })
                .select('quizId')
                .lean();
            completedQuizIds = userResults.map(result => result.quizId.toString());
        }

        // Frontend uchun ma'lumotlarni tayyorlash
        const transformedQuizzes = quizzes.map(quiz => ({
            _id: quiz._id,
            name: quiz.name,
            description: quiz.description,
            category: quiz.category,
            difficulty: quiz.difficulty,
            timeLimit: quiz.timeLimit,
            color: quiz.color || 'blue',
            rating: quiz.rating || 4.5,
            totalQuestions: quiz.totalQuestions || 0,
            playCount: quiz.playCount || 0,
            isCompleted: completedQuizIds.includes(quiz._id.toString())
        }));

        res.json({
            success: true,
            data: transformedQuizzes
        });

    } catch (error) {
        console.error('❌ GET ALL QUIZZES ERROR:', error);
        res.status(500).json({
            success: false,
            message: 'Server xatosi',
            error: error.message
        });
    }
};

// =============== CREATE QUIZ (Admin) ===============
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

        // Admin tekshiruvi
        if (!req.admin && !req.user) {
            return res.status(401).json({
                success: false,
                message: 'Avtorizatsiya talab qilinadi'
            });
        }

        // Quiz yaratish
        const quiz = new Quiz({
            name,
            description,
            category,
            difficulty: difficulty || 'medium',
            timeLimit,
            color: color || 'blue',
            isActive: isActive !== undefined ? isActive : true,
            totalQuestions: questions.length,
            createdBy: req.admin?._id || req.user?._id,
            createdByType: req.admin ? 'admin' : 'user',
            rating: 4.5,
            playCount: 0
        });

        const savedQuiz = await quiz.save();

        // Savollarni yaratish
        const questionPromises = questions.map((q) => {
            const question = new Question({
                quizId: savedQuiz._id,
                questionText: q.questionText,
                options: q.options.map(opt => ({
                    text: opt.text,
                    isCorrect: opt.isCorrect || false
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
        console.error('❌ CREATE QUIZ ERROR:', error);
        res.status(500).json({
            success: false,
            message: 'Quiz yaratishda xatolik',
            error: error.message
        });
    }
};

// =============== OTHER FUNCTIONS ===============
export const getCompletedQuizzes = async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'userId talab qilinadi'
            });
        }

        // Userning yechgan quiz natijalarini olish
        const results = await Result.find({ userId })
            .populate('quizId', 'name description category timeLimit color rating totalQuestions')
            .sort({ createdAt: -1 })
            .lean();

        // Quiz ma'lumotlari bor natijalarni filter qilish
        const completedQuizzes = results
            .filter(result => result.quizId)
            .map(result => ({
                ...result.quizId,
                resultId: result._id,
                completedAt: result.createdAt,
                score: result.score,
                correctAnswers: result.correctAnswers,
                totalQuestions: result.totalQuestions,
                coinsEarned: result.coinsEarned,
                xpEarned: result.xpEarned,
                isCompleted: true
            }));

        res.json({
            success: true,
            data: completedQuizzes
        });

    } catch (error) {
        console.error('❌ GET COMPLETED QUIZZES ERROR:', error);
        res.status(500).json({
            success: false,
            message: 'Server xatosi',
            error: error.message
        });
    }
};

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
        console.error('❌ GET USER QUIZ HISTORY ERROR:', error);
        res.status(500).json({
            success: false,
            message: 'Server xatosi',
            error: error.message
        });
    }
};

export const getMyQuizzes = async (req, res) => {
    try {
        const user = req.user || req.admin;

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Avtorizatsiya talab qilinadi'
            });
        }

        const quizzes = await Quiz.find({ createdBy: user._id })
            .sort({ createdAt: -1 })
            .select('name description category difficulty timeLimit totalQuestions isActive playCount createdAt')
            .lean();

        res.json({
            success: true,
            data: quizzes
        });

    } catch (error) {
        console.error('❌ GET MY QUIZZES ERROR:', error);
        res.status(500).json({
            success: false,
            message: 'Server xatosi',
            error: error.message
        });
    }
};

export const deleteQuiz = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user || req.admin;

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Avtorizatsiya talab qilinadi'
            });
        }

        // Quizni topish
        const quiz = await Quiz.findById(id);

        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: 'Quiz topilmadi'
            });
        }

        // User quiz egasi yoki admin ekanligini tekshirish
        if (quiz.createdBy.toString() !== user._id.toString() && !user.isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Bu quizni o\'chirish huquqingiz yo\'q'
            });
        }

        // Bog'liq savollarni o'chirish
        await Question.deleteMany({ quizId: id });

        // Resultlarni o'chirish (agar kerak bo'lsa)
        await Result.deleteMany({ quizId: id });

        // Quizni o'chirish
        await Quiz.findByIdAndDelete(id);

        res.json({
            success: true,
            message: 'Quiz muvaffaqiyatli o\'chirildi'
        });

    } catch (error) {
        console.error('❌ DELETE QUIZ ERROR:', error);
        res.status(500).json({
            success: false,
            message: 'Server xatosi',
            error: error.message
        });
    }
};