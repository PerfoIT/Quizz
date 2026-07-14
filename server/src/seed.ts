import { PrismaClient } from "@prisma/client";

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
  const quiz = await prisma.quiz.upsert({
    where: { id: "demo-perfo-ai" },
    update: {},
    create: {
      id: "demo-perfo-ai",
      title: "Seminaire IA PERFO",
      description: "Quiz de demonstration pour animer un seminaire interne sur l'intelligence artificielle."
    }
  });

  for (const [index, question] of questions.entries()) {
    const bankQuestion = await prisma.bankQuestion.upsert({
      where: { id: `demo-bank-question-${index + 1}` },
      update: {
        type: "QCM",
        text: question.text,
        explanation: question.explanation,
        timeLimitSeconds: 15
      },
      create: {
        id: `demo-bank-question-${index + 1}`,
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
        type: "QCM",
        text: question.text,
        explanation: question.explanation,
        timeLimitSeconds: 15
      },
      create: {
        quizId: quiz.id,
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
