import mongoose from 'mongoose';
import Task from '../models/Task.js';
import dotenv from 'dotenv';

dotenv.config();

const tasks = [
    {
        title: "Telegram Kanalga Obuna Bo'lish",
        description: "Bizning rasmiy Telegram kanalimizga obuna bo'ling va yangiliklar bilan qoling",
        icon: "Bell",
        type: "subscription",
        coins: 30,
        requiredAction: "Obuna bo'lish",
        externalLink: "https://t.me/quiz_master_uz",
        timeEstimate: "1 daqiqa",
        color: "from-blue-600 to-blue-800",
        category: "one-time",
        difficulty: "easy",
        maxCompletions: 1,
        tags: ["social", "telegram"],
        requirements: {
            minLevel: 1,
            minCoins: 0
        }
    },
    {
        title: "Kunlik Reklama Ko'rish",
        description: "30 soniyalik reklamani ko'rib, pul ishlash imkoniyatiga ega bo'ling",
        icon: "Eye",
        type: "advertisement",
        coins: 20,
        requiredAction: "Reklamani ko'rish",
        timeEstimate: "30 soniya",
        color: "from-green-600 to-green-800",
        category: "daily",
        difficulty: "easy",
        maxCompletions: 5,
        cooldownHours: 1,
        tags: ["ad", "daily"],
        requirements: {
            minLevel: 1,
            minCoins: 0
        }
    },
    {
        title: "10 ta Savolga Javob Berish",
        description: "Har qanday quizda 10 ta savolga javob bering",
        icon: "CheckSquare",
        type: "quiz",
        coins: 15,
        requiredAction: "Quiz yechish",
        link: "/play",
        timeEstimate: "5 daqiqa",
        color: "from-purple-600 to-purple-800",
        category: "daily",
        difficulty: "medium",
        maxCompletions: 3,
        tags: ["quiz", "learning"],
        requirements: {
            minLevel: 1,
            minCoins: 0
        }
    },
    {
        title: "3 ta Do'stni Taklif Qilish",
        description: "Do'stlaringizni platformaga taklif qiling va ular birinchi quizni tugatganda bonus oling",
        icon: "Users",
        type: "referral",
        coins: 120,
        requiredAction: "Do'st taklif qilish",
        timeEstimate: "2 daqiqa",
        color: "from-pink-600 to-pink-800",
        category: "weekly",
        difficulty: "hard",
        maxCompletions: 1,
        requirements: {
            minLevel: 3,
            minCoins: 100
        }
    },
    {
        title: "3 Kunlik Streak Saqlash",
        description: "3 kun ketma-ket quiz o'ynash orqali streakni saqlang",
        icon: "Calendar",
        type: "streak",
        coins: 60,
        requiredAction: "Streakni davom ettirish",
        timeEstimate: "3 kun",
        color: "from-amber-600 to-amber-800",
        category: "weekly",
        difficulty: "medium",
        maxCompletions: 1,
        requirements: {
            minLevel: 2,
            minCoins: 50
        }
    },
    {
        title: "Birinchi Quizni Tamomlash",
        description: "Platformadagi birinchi quizingizni muvaffaqiyatli yakunlang",
        icon: "Trophy",
        type: "achievement",
        coins: 25,
        requiredAction: "Quizni tamomlash",
        link: "/play",
        timeEstimate: "3 daqiqa",
        color: "from-emerald-600 to-emerald-800",
        category: "one-time",
        difficulty: "easy",
        maxCompletions: 1,
        tags: ["achievement", "first"],
        requirements: {
            minLevel: 1,
            minCoins: 0
        }
    },
    {
        title: "Profil Ma'lumotlarini To'ldirish",
        description: "Profilingizdagi barcha ma'lumotlarni to'ldiring",
        icon: "Target",
        type: "profile",
        coins: 20,
        requiredAction: "Profilni to'ldirish",
        link: "/profile",
        timeEstimate: "2 daqiqa",
        color: "from-cyan-600 to-cyan-800",
        category: "one-time",
        difficulty: "easy",
        maxCompletions: 1,
        tags: ["profile", "setup"],
        requirements: {
            minLevel: 1,
            minCoins: 0
        }
    },
    {
        title: "100 Ball To'plash",
        description: "Quizlarda jami 100 ball to'plang",
        icon: "TrendingUp",
        type: "score",
        coins: 40,
        requiredAction: "Ball to'plash",
        link: "/play",
        timeEstimate: "Harakat talab qiladi",
        color: "from-orange-600 to-orange-800",
        category: "weekly",
        difficulty: "hard",
        maxCompletions: 2,
        requirements: {
            minLevel: 2,
            minCoins: 50,
            previousTasks: [] // This will be populated with IDs
        }
    },
    {
        title: "Premium O'yin O'ynash",
        description: "Premium darajadagi quizlardan birini o'ynang",
        icon: "Crown",
        type: "premium",
        coins: 60,
        requiredAction: "Premium quiz o'ynash",
        link: "/play",
        timeEstimate: "10 daqiqa",
        color: "from-violet-600 to-violet-800",
        category: "daily",
        difficulty: "expert",
        maxCompletions: 1,
        requirements: {
            minLevel: 5,
            minCoins: 200
        }
    },
    {
        title: "Har Bir Kategoriyada Quiz",
        description: "Har bir kategoriyada kamida 1 ta quiz yeching",
        icon: "BookOpen",
        type: "category",
        coins: 100,
        requiredAction: "Kategoriyalarni o'rganish",
        link: "/play",
        timeEstimate: "30 daqiqa",
        color: "from-rose-600 to-rose-800",
        category: "monthly",
        difficulty: "expert",
        maxCompletions: 1,
        requirements: {
            minLevel: 3,
            minCoins: 100
        }
    }
];

const seedTasks = async () => {
    try {
        await mongoose.connect("mongodb+srv://therakhimoffdev:40g948_SA@slot.yn1tdwo.mongodb.net/quizzo?retryWrites=true&w=majority");
        console.log('Connected to MongoDB');

        // Clear existing tasks
        await Task.deleteMany({});
        console.log('Cleared existing tasks');

        // Insert new tasks
        for (const task of tasks) {
            const newTask = new Task(task);
            await newTask.save();
            console.log(`Created task: ${task.title}`);
        }

        console.log('Tasks seeded successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding tasks:', error);
        process.exit(1);
    }
};

seedTasks();