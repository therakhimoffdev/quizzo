import Quiz from '../models/Quiz.js';
import Question from '../models/Question.js';
import Result from '../models/Result.js';
import User from '../models/User.js';

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
export const submitQuiz = async (req, res) => {
    try {
        const { userId, quizId, answers, timeSpent } = req.body;

        // Get questions with correct answers
        const questions = await Question.find({ quizId });

        let correctCount = 0;
        let totalScore = 0;
        const detailedAnswers = [];

        // Calculate results
        for (const answer of answers) {
            const question = questions.find(q => q._id.toString() === answer.questionId);
            if (!question) continue;

            const isCorrect = question.options[answer.selectedOption]?.isCorrect || false;

            if (isCorrect) {
                correctCount++;
                totalScore += question.points;
            }

            detailedAnswers.push({
                questionId: answer.questionId,
                selectedOption: answer.selectedOption,
                isCorrect,
                timeTaken: answer.timeTaken
            });
        }

        // Calculate coins and XP
        const coinsEarned = correctCount * 10; // 10 coins per correct answer
        const xpEarned = Math.floor(totalScore / 10);

        // Save result
        const result = new Result({
            userId,
            quizId,
            score: totalScore,
            totalQuestions: questions.length,
            correctAnswers: correctCount,
            wrongAnswers: questions.length - correctCount,
            timeSpent,
            answers: detailedAnswers,
            coinsEarned,
            xpEarned
        });
        await result.save();

        // Update user stats
        const user = await User.findById(userId);
        if (user) {
            user.coins += coinsEarned;
            user.xp += xpEarned;
            user.total_games += 1;
            user.correct_answers += correctCount;
            user.wrong_answers += (questions.length - correctCount);

            // Calculate level (every 1000 XP = 1 level)
            user.level = Math.floor(user.xp / 1000) + 1;

            await user.save();
        }

        res.json({
            success: true,
            data: {
                result: {
                    score: totalScore,
                    correctAnswers: correctCount,
                    totalQuestions: questions.length,
                    coinsEarned,
                    xpEarned,
                    timeSpent
                }
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