import { PrismaClient } from "@prisma/client";
import { hashPassword } from "./auth.js";

const prisma = new PrismaClient();

const questions = [
  {
    text: "L'IA generative sert principalement a...",
    explanation: "Elle produit du texte, des images, du code ou des idees a partir d'une consigne.",
    answers: [
      ["chercher des pages web", false],
      ["produire du contenu a partir d'une demande", true],
      ["remplacer tous les metiers", false],
      ["stocker des fichiers", false]
    ]
  },
  {
    text: "Une reponse fluide d'une IA est...",
    explanation: "La forme peut etre convaincante meme lorsque le fond contient une erreur.",
    answers: [
      ["toujours vraie", false],
      ["forcement sourcee", false],
      ["parfois fausse malgre un ton convaincant", true],
      ["impossible a verifier", false]
    ]
  },
  {
    text: "NotebookLM est surtout utile pour...",
    explanation: "Il aide a questionner, synthetiser et explorer les documents que l'on fournit.",
    answers: [
      ["generer de la musique", false],
      ["interroger des documents fournis", true],
      ["faire de la comptabilite", false],
      ["piloter une machine", false]
    ]
  },
  {
    text: "La bonne attitude face a une reponse IA est...",
    explanation: "Les informations importantes doivent rester verifiees, surtout en contexte professionnel.",
    answers: [
      ["copier-coller sans relire", false],
      ["toujours verifier les informations importantes", true],
      ["eviter totalement l'IA", false],
      ["supprimer les sources", false]
    ]
  },
  {
    text: "Le meilleur usage de l'IA pour un formateur est...",
    explanation: "L'IA accelere la preparation, mais l'expertise pedagogique reste humaine.",
    answers: [
      ["remplacer son expertise", false],
      ["accelerer la preparation et ameliorer les supports", true],
      ["faire cours a sa place", false],
      ["noter les stagiaires sans controle", false]
    ]
  }
] as const;

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL ?? "admin@perfo.local" },
    update: {
      name: process.env.ADMIN_NAME ?? "Administrateur PERFO",
      role: "ADMIN"
    },
    create: {
      email: process.env.ADMIN_EMAIL ?? "admin@perfo.local",
      name: process.env.ADMIN_NAME ?? "Administrateur PERFO",
      role: "ADMIN",
      passwordHash: hashPassword(process.env.ADMIN_PASSWORD ?? "perfo-admin")
    }
  });

  const quiz = await prisma.quiz.upsert({
    where: { id: "demo-perfo-ai" },
    update: { ownerId: admin.id, visibility: "ORGANIZATION" },
    create: {
      id: "demo-perfo-ai",
      ownerId: admin.id,
      visibility: "ORGANIZATION",
      title: "Seminaire IA PERFO",
      description: "Quiz de demonstration pour animer un seminaire interne sur l'intelligence artificielle."
    }
  });

  for (const [index, question] of questions.entries()) {
    const bankQuestion = await prisma.bankQuestion.upsert({
      where: { id: `demo-bank-question-${index + 1}` },
      update: {
        ownerId: admin.id,
        visibility: "ORGANIZATION",
        type: "QCM",
        text: question.text,
        explanation: question.explanation,
        timeLimitSeconds: 15
      },
      create: {
        id: `demo-bank-question-${index + 1}`,
        ownerId: admin.id,
        visibility: "ORGANIZATION",
        type: "QCM",
        text: question.text,
        explanation: question.explanation,
        timeLimitSeconds: 15
      }
    });

    for (const [answerIndex, [text, isCorrect]] of question.answers.entries()) {
      await prisma.bankAnswer.upsert({
        where: { bankQuestionId_order: { bankQuestionId: bankQuestion.id, order: answerIndex + 1 } },
        update: { text, isCorrect },
        create: {
          bankQuestionId: bankQuestion.id,
          order: answerIndex + 1,
          text,
          isCorrect
        }
      });
    }

    const savedQuestion = await prisma.question.upsert({
      where: { quizId_order: { quizId: quiz.id, order: index } },
      update: {
        sourceBankQuestionId: bankQuestion.id,
        type: "QCM",
        text: question.text,
        explanation: question.explanation,
        timeLimitSeconds: 15
      },
      create: {
        quizId: quiz.id,
        sourceBankQuestionId: bankQuestion.id,
        type: "QCM",
        order: index,
        text: question.text,
        explanation: question.explanation,
          timeLimitSeconds: 15
      }
    });

    for (const [answerIndex, [text, isCorrect]] of question.answers.entries()) {
      await prisma.answer.upsert({
        where: { questionId_order: { questionId: savedQuestion.id, order: answerIndex + 1 } },
        update: { text, isCorrect },
        create: {
          questionId: savedQuestion.id,
          order: answerIndex + 1,
          text,
          isCorrect
        }
      });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
