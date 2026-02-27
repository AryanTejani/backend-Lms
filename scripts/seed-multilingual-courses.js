#!/usr/bin/env node

/**
 * Seed multilingual demo courses for VidyaSetu.
 *
 * Creates ~32 courses across 8 Indian languages, each with:
 *   - 2 sections, 2 lessons per section, 2 topics per section, 1 quiz with 3 questions
 *
 * All content (lessons, topics, quizzes) is in the native language of each course.
 *
 * Usage:
 *   node scripts/seed-multilingual-courses.js
 *
 * Connects using DATABASE_URL from .env (falls back to postgres://postgres:StrongPassword123@localhost:5432/postgres)
 */

const { randomUUID } = require('crypto');
const pg = require('pg');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

require('dotenv').config();
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:StrongPassword123@localhost:5432/postgres';

const ADMIN_STAFF_ID = '00000000-0000-0000-0000-000000000001';

const INSTRUCTORS = {
  maths: '00000000-0000-0000-0000-000000000002',
  science: '00000000-0000-0000-0000-000000000003',
  language: '00000000-0000-0000-0000-000000000004',
  social: '00000000-0000-0000-0000-000000000005',
};

// ---------------------------------------------------------------------------
// Course definitions per language — ALL content in native language
// ---------------------------------------------------------------------------

const LANGUAGES = [
  // -------------------------------------------------------------------------
  // HINDI (hi)
  // -------------------------------------------------------------------------
  {
    code: 'hi',
    courses: [
      {
        subject: 'maths', name: 'भिन्न एवं दशमलव', slug: 'bhinn-evam-dashamlav-hi',
        desc: 'NCERT कक्षा 5 गणित — भिन्न, दशमलव और संख्या ज्ञान हिंदी में सीखें।',
        sections: [
          {
            title: 'भिन्नों का परिचय',
            lessons: [
              { title: 'भिन्न क्या है?', content: 'भिन्न एक संख्या का हिस्सा होता है। उदाहरण: 1/2 का मतलब है आधा।' },
              { title: 'अंश और हर', content: 'ऊपर की संख्या को अंश और नीचे की संख्या को हर कहते हैं।' },
            ],
            topics: [
              { title: 'भिन्न को समझना — व्याख्या', content: 'भिन्न का अर्थ है पूरे का एक भाग। जैसे एक रोटी के दो बराबर हिस्से करें तो हर हिस्सा 1/2 है।' },
              { title: 'अभ्यास: भिन्नों की पहचान', content: 'नीचे दी गई आकृतियों में रंगीन भाग को भिन्न रूप में लिखें।' },
            ],
          },
          {
            title: 'दशमलव संख्याएँ',
            lessons: [
              { title: 'दशमलव का परिचय', content: 'दशमलव बिंदु के बाद वाले अंक दसवें, सौवें भाग दर्शाते हैं।' },
              { title: 'दशमलव जोड़ और घटाना', content: 'दशमलव बिंदु को एक पंक्ति में रखकर जोड़ या घटाएँ।' },
            ],
            topics: [
              { title: 'दशमलव स्थान मान', content: 'दशमलव बिंदु के दाईं ओर पहला स्थान दसवाँ और दूसरा सौवाँ होता है।' },
              { title: 'अभ्यास: दशमलव रूपांतरण', content: 'भिन्न 1/4 को दशमलव में बदलें: 1÷4 = 0.25।' },
            ],
          },
        ],
        quiz: {
          title: 'भिन्न एवं दशमलव प्रश्नोत्तरी',
          questions: [
            { q: 'भिन्न 3/4 में हर क्या है?', opts: ['4', '3', '7', '1'], correct: 0 },
            { q: '0.5 को भिन्न में कैसे लिखेंगे?', opts: ['1/2', '1/3', '1/4', '1/5'], correct: 0 },
            { q: '1/2 + 1/4 कितना होता है?', opts: ['3/4', '2/4', '1/6', '2/6'], correct: 0 },
          ],
        },
      },
      {
        subject: 'science', name: 'पौधे और प्रकाश संश्लेषण', slug: 'paudhe-aur-prakash-hi',
        desc: 'NCERT कक्षा 5 विज्ञान — पौधे कैसे भोजन बनाते हैं, हिंदी में समझें।',
        sections: [
          {
            title: 'प्रकाश संश्लेषण की मूल बातें',
            lessons: [
              { title: 'प्रकाश संश्लेषण क्या है?', content: 'पौधे सूर्य के प्रकाश, पानी और कार्बन डाइऑक्साइड से अपना भोजन बनाते हैं।' },
              { title: 'पत्तियों की भूमिका', content: 'पत्तियों में क्लोरोफिल होता है जो प्रकाश संश्लेषण में मदद करता है।' },
            ],
            topics: [
              { title: 'क्लोरोफिल और हरा रंग', content: 'क्लोरोफिल एक हरा वर्णक है जो सूर्य के प्रकाश को अवशोषित करता है।' },
              { title: 'प्रयोग: पत्ती में स्टार्च', content: 'आयोडीन परीक्षण से पत्ती में स्टार्च की उपस्थिति जाँचें।' },
            ],
          },
          {
            title: 'पौधों का जीवन चक्र',
            lessons: [
              { title: 'बीज से पौधा', content: 'बीज अंकुरित होकर जड़, तना और पत्तियाँ बनाता है।' },
              { title: 'परागण और फल', content: 'फूलों में परागण के बाद फल और बीज बनते हैं।' },
            ],
            topics: [
              { title: 'अंकुरण की प्रक्रिया', content: 'बीज को नमी, गर्मी और हवा मिलने पर अंकुरण होता है।' },
              { title: 'गतिविधि: बीज उगाना', content: 'गीले रूई पर मूँग के बीज रखकर 5 दिन तक निरीक्षण करें।' },
            ],
          },
        ],
        quiz: {
          title: 'पौधे और प्रकाश संश्लेषण प्रश्नोत्तरी',
          questions: [
            { q: 'प्रकाश संश्लेषण में पौधे कौन सी गैस अवशोषित करते हैं?', opts: ['कार्बन डाइऑक्साइड', 'ऑक्सीजन', 'नाइट्रोजन', 'हाइड्रोजन'], correct: 0 },
            { q: 'पौधे का कौन सा भाग भोजन बनाता है?', opts: ['पत्ती', 'जड़', 'तना', 'फूल'], correct: 0 },
            { q: 'प्रकाश संश्लेषण के लिए क्या आवश्यक है?', opts: ['सूर्य का प्रकाश और पानी', 'मिट्टी और हवा', 'बारिश और आग', 'बर्फ और ठंड'], correct: 0 },
          ],
        },
      },
      {
        subject: 'language', name: 'हिंदी पठन और लेखन', slug: 'hindi-pathan-lekhan-hi',
        desc: 'NCERT कक्षा 5 हिंदी — पढ़ना, लिखना और व्याकरण अभ्यास।',
        sections: [
          {
            title: 'पठन कौशल',
            lessons: [
              { title: 'कहानी पढ़ना', content: 'कहानी पढ़कर मुख्य पात्र, घटना और संदेश पहचानना सीखें।' },
              { title: 'शब्द भंडार बढ़ाना', content: 'नए शब्दों का अर्थ जानें और वाक्यों में प्रयोग करें।' },
            ],
            topics: [
              { title: 'मुख्य विचार ढूँढना', content: 'किसी अनुच्छेद का मुख्य विचार वह बात है जो पूरा पैराग्राफ बताना चाहता है।' },
              { title: 'अभ्यास: प्रश्न-उत्तर', content: 'दी गई कहानी पढ़कर नीचे दिए प्रश्नों के उत्तर लिखें।' },
            ],
          },
          {
            title: 'लेखन और व्याकरण',
            lessons: [
              { title: 'संज्ञा और सर्वनाम', content: 'संज्ञा किसी व्यक्ति, वस्तु या स्थान का नाम है; सर्वनाम संज्ञा के बदले आता है।' },
              { title: 'पत्र लेखन', content: 'औपचारिक पत्र में प्रेषक का पता, दिनांक, विषय और अभिवादन होता है।' },
            ],
            topics: [
              { title: 'क्रिया और विशेषण', content: 'क्रिया काम को बताती है और विशेषण संज्ञा की विशेषता बताता है।' },
              { title: 'अभ्यास: निबंध लिखें', content: '"मेरा प्रिय त्योहार" विषय पर 10 वाक्यों का निबंध लिखें।' },
            ],
          },
        ],
        quiz: {
          title: 'हिंदी पठन और लेखन प्रश्नोत्तरी',
          questions: [
            { q: 'संज्ञा क्या है?', opts: ['किसी व्यक्ति, वस्तु या स्थान का नाम', 'क्रिया का दूसरा नाम', 'विशेषण का प्रकार', 'सर्वनाम का पर्याय'], correct: 0 },
            { q: 'विराम चिह्न का क्या उपयोग है?', opts: ['वाक्य को स्पष्ट बनाना', 'वाक्य को लम्बा करना', 'रंग जोड़ना', 'शब्द हटाना'], correct: 0 },
            { q: 'पर्यायवाची शब्द का अर्थ क्या है?', opts: ['समान अर्थ वाला शब्द', 'विपरीत अर्थ वाला शब्द', 'क्रिया का प्रकार', 'एक सर्वनाम'], correct: 0 },
          ],
        },
      },
      {
        subject: 'social', name: 'भारत का इतिहास', slug: 'bharat-ka-itihas-hi',
        desc: 'NCERT कक्षा 5 सामाजिक विज्ञान — प्राचीन सभ्यताओं से स्वतंत्रता आंदोलन तक।',
        sections: [
          {
            title: 'प्राचीन भारत',
            lessons: [
              { title: 'सिंधु घाटी सभ्यता', content: 'सिंधु घाटी सभ्यता लगभग 5000 वर्ष पुरानी है और मोहनजोदड़ो इसका प्रमुख नगर था।' },
              { title: 'वैदिक काल', content: 'वैदिक काल में वेदों की रचना हुई और कृषि प्रमुख व्यवसाय था।' },
            ],
            topics: [
              { title: 'मोहनजोदड़ो की खोज', content: 'मोहनजोदड़ो में नगर नियोजन, स्नानागार और जल निकास व्यवस्था मिली।' },
              { title: 'मानचित्र गतिविधि', content: 'भारत के मानचित्र पर सिंधु घाटी के प्रमुख स्थलों को चिह्नित करें।' },
            ],
          },
          {
            title: 'स्वतंत्रता संग्राम',
            lessons: [
              { title: 'महात्मा गांधी और अहिंसा', content: 'गांधी जी ने सत्य और अहिंसा के मार्ग से भारत को स्वतंत्रता दिलाई।' },
              { title: '1947: स्वतंत्रता दिवस', content: '15 अगस्त 1947 को भारत ब्रिटिश शासन से स्वतंत्र हुआ।' },
            ],
            topics: [
              { title: 'नमक सत्याग्रह', content: '1930 में गांधी जी ने दांडी यात्रा करके नमक कानून तोड़ा।' },
              { title: 'समयरेखा: स्वतंत्रता के चरण', content: '1857 का विद्रोह, असहयोग आंदोलन, भारत छोड़ो आंदोलन — प्रमुख घटनाओं को क्रम में रखें।' },
            ],
          },
        ],
        quiz: {
          title: 'भारत का इतिहास प्रश्नोत्तरी',
          questions: [
            { q: 'भारत की सबसे लंबी नदी कौन सी है?', opts: ['गंगा', 'यमुना', 'गोदावरी', 'नर्मदा'], correct: 0 },
            { q: 'भारत के प्रथम प्रधानमंत्री कौन थे?', opts: ['जवाहरलाल नेहरू', 'महात्मा गांधी', 'सरदार पटेल', 'बी.आर. अंबेडकर'], correct: 0 },
            { q: 'भारत की राजधानी क्या है?', opts: ['नई दिल्ली', 'मुंबई', 'कोलकाता', 'चेन्नई'], correct: 0 },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // TELUGU (te)
  // -------------------------------------------------------------------------
  {
    code: 'te',
    courses: [
      {
        subject: 'maths', name: 'భిన్నాలు మరియు దశాంశాలు', slug: 'bhinnalu-dashamshalu-te',
        desc: 'NCERT 5వ తరగతి గణితం — భిన్నాలు, దశాంశాలు తెలుగులో నేర్చుకోండి।',
        sections: [
          {
            title: 'భిన్నాల పరిచయం',
            lessons: [
              { title: 'భిన్నం అంటే ఏమిటి?', content: 'భిన్నం అంటే మొత్తంలో ఒక భాగం. ఉదాహరణ: 1/2 అంటే సగం.' },
              { title: 'లవం మరియు హారం', content: 'పై సంఖ్యను లవం అని, కింది సంఖ్యను హారం అని అంటారు.' },
            ],
            topics: [
              { title: 'భిన్నాలను అర్థం చేసుకోవడం', content: 'భిన్నం అంటే పూర్తి వస్తువులో ఒక భాగం. ఒక రొట్టెను రెండు సమాన భాగాలుగా చేస్తే ప్రతి భాగం 1/2.' },
              { title: 'అభ్యాసం: భిన్నాలను గుర్తించండి', content: 'కింది బొమ్మలలో రంగు వేసిన భాగాన్ని భిన్నంగా రాయండి.' },
            ],
          },
          {
            title: 'దశాంశ సంఖ్యలు',
            lessons: [
              { title: 'దశాంశం పరిచయం', content: 'దశాంశ బిందువు తర్వాత ఉన్న అంకెలు పదవ, శతమ భాగాలను సూచిస్తాయి.' },
              { title: 'దశాంశాల కూడిక మరియు తీసివేత', content: 'దశాంశ బిందువులను ఒకే వరుసలో ఉంచి కూడండి లేదా తీసివేయండి.' },
            ],
            topics: [
              { title: 'దశాంశ స్థాన విలువ', content: 'దశాంశ బిందువుకు కుడివైపు మొదటి స్థానం పదవ భాగం, రెండవ స్థానం శతమ భాగం.' },
              { title: 'అభ్యాసం: దశాంశ మార్పిడి', content: 'భిన్నం 1/4 ను దశాంశంగా మార్చండి: 1÷4 = 0.25.' },
            ],
          },
        ],
        quiz: {
          title: 'భిన్నాలు మరియు దశాంశాలు క్విజ్',
          questions: [
            { q: 'భిన్నం 3/4 లో హారం ఏమిటి?', opts: ['4', '3', '7', '1'], correct: 0 },
            { q: '0.5 ను భిన్నంగా ఎలా రాస్తారు?', opts: ['1/2', '1/3', '1/4', '1/5'], correct: 0 },
            { q: '1/2 + 1/4 ఎంత?', opts: ['3/4', '2/4', '1/6', '2/6'], correct: 0 },
          ],
        },
      },
      {
        subject: 'science', name: 'మొక్కలు మరియు కిరణజన్య సంయోగక్రియ', slug: 'mokkalu-kiranajannya-te',
        desc: 'NCERT 5వ తరగతి సైన్స్ — మొక్కలు ఆహారం ఎలా తయారు చేస్తాయో తెలుగులో తెలుసుకోండి।',
        sections: [
          {
            title: 'కిరణజన్య సంయోగక్రియ ప్రాథమికాలు',
            lessons: [
              { title: 'కిరణజన్య సంయోగక్రియ అంటే ఏమిటి?', content: 'మొక్కలు సూర్యకాంతి, నీరు మరియు కార్బన్ డయాక్సైడ్ నుండి ఆహారాన్ని తయారు చేస్తాయి.' },
              { title: 'ఆకుల పాత్ర', content: 'ఆకులలో క్లోరోఫిల్ ఉంటుంది, ఇది కిరణజన్య సంయోగక్రియలో సహాయపడుతుంది.' },
            ],
            topics: [
              { title: 'క్లోరోఫిల్ మరియు ఆకుపచ్చ రంగు', content: 'క్లోరోఫిల్ ఒక ఆకుపచ్చ వర్ణద్రవ్యం, ఇది సూర్యకాంతిని గ్రహిస్తుంది.' },
              { title: 'ప్రయోగం: ఆకులో పిండి పదార్థం', content: 'అయోడిన్ పరీక్ష ద్వారా ఆకులో పిండి పదార్థం ఉందో లేదో తెలుసుకోండి.' },
            ],
          },
          {
            title: 'మొక్కల జీవిత చక్రం',
            lessons: [
              { title: 'విత్తనం నుండి మొక్క', content: 'విత్తనం మొలకెత్తి వేరు, కాండం మరియు ఆకులు ఏర్పడతాయి.' },
              { title: 'పరాగసంపర్కం మరియు ఫలాలు', content: 'పువ్వులలో పరాగసంపర్కం తర్వాత ఫలాలు మరియు విత్తనాలు ఏర్పడతాయి.' },
            ],
            topics: [
              { title: 'మొలకెత్తడం ప్రక్రియ', content: 'విత్తనానికి తేమ, వేడి మరియు గాలి అందినప్పుడు మొలకెత్తడం జరుగుతుంది.' },
              { title: 'కార్యకలాపం: విత్తనాలు నాటడం', content: 'తడి పత్తిపై పెసర విత్తనాలు ఉంచి 5 రోజులు పరిశీలించండి.' },
            ],
          },
        ],
        quiz: {
          title: 'మొక్కలు మరియు కిరణజన్య సంయోగక్రియ క్విజ్',
          questions: [
            { q: 'కిరణజన్య సంయోగక్రియలో మొక్కలు ఏ వాయువును గ్రహిస్తాయి?', opts: ['కార్బన్ డయాక్సైడ్', 'ఆక్సిజన్', 'నైట్రోజన్', 'హైడ్రోజన్'], correct: 0 },
            { q: 'మొక్కలో ఆహారం తయారు చేసే భాగం ఏది?', opts: ['ఆకు', 'వేరు', 'కాండం', 'పువ్వు'], correct: 0 },
            { q: 'కిరణజన్య సంయోగక్రియకు ఏమి అవసరం?', opts: ['సూర్యకాంతి మరియు నీరు', 'మట్టి మరియు గాలి', 'వర్షం మరియు అగ్ని', 'మంచు మరియు చలి'], correct: 0 },
          ],
        },
      },
      {
        subject: 'language', name: 'తెలుగు పఠనం మరియు రచన', slug: 'telugu-pathanam-rachana-te',
        desc: 'NCERT 5వ తరగతి తెలుగు — చదవడం, రాయడం మరియు వ్యాకరణ అభ్యాసం।',
        sections: [
          {
            title: 'పఠన నైపుణ్యాలు',
            lessons: [
              { title: 'కథ చదవడం', content: 'కథ చదివి ముఖ్య పాత్ర, సంఘటన మరియు సందేశాన్ని గుర్తించడం నేర్చుకోండి.' },
              { title: 'పదజాలం పెంచుకోవడం', content: 'కొత్త పదాల అర్థం తెలుసుకుని వాక్యాలలో ఉపయోగించండి.' },
            ],
            topics: [
              { title: 'ముఖ్య ఆలోచన గుర్తించడం', content: 'ఏదైనా పేరాలోని ముఖ్య ఆలోచన మొత్తం పేరా చెప్పదలచుకున్న విషయం.' },
              { title: 'అభ్యాసం: ప్రశ్న-జవాబు', content: 'ఇచ్చిన కథ చదివి కింది ప్రశ్నలకు సమాధానాలు రాయండి.' },
            ],
          },
          {
            title: 'రచన మరియు వ్యాకరణం',
            lessons: [
              { title: 'నామవాచకం మరియు సర్వనామం', content: 'నామవాచకం ఒక వ్యక్తి, వస్తువు లేదా ప్రదేశం పేరు; సర్వనామం నామవాచకం బదులు వస్తుంది.' },
              { title: 'లేఖ రాయడం', content: 'అధికారిక లేఖలో పంపినవారి చిరునామా, తేదీ, విషయం మరియు అభివందనం ఉంటుంది.' },
            ],
            topics: [
              { title: 'క్రియ మరియు విశేషణం', content: 'క్రియ పనిని తెలుపుతుంది, విశేషణం నామవాచకం లక్షణాన్ని వివరిస్తుంది.' },
              { title: 'అభ్యాసం: వ్యాసం రాయండి', content: '"నా ఇష్టమైన పండుగ" అనే అంశంపై 10 వాక్యాల వ్యాసం రాయండి.' },
            ],
          },
        ],
        quiz: {
          title: 'తెలుగు పఠనం మరియు రచన క్విజ్',
          questions: [
            { q: 'నామవాచకం అంటే ఏమిటి?', opts: ['వ్యక్తి, వస్తువు లేదా ప్రదేశం పేరు', 'క్రియ యొక్క మరో పేరు', 'విశేషణం రకం', 'సర్వనామం పర్యాయపదం'], correct: 0 },
            { q: 'విరామ చిహ్నాల ఉపయోగం ఏమిటి?', opts: ['వాక్యాన్ని స్పష్టంగా చేయడం', 'వాక్యాన్ని పొడిగించడం', 'రంగు జోడించడం', 'పదాలు తొలగించడం'], correct: 0 },
            { q: 'పర్యాయపదం అంటే ఏమిటి?', opts: ['సమానార్థం గల పదం', 'వ్యతిరేకార్థం గల పదం', 'క్రియ రకం', 'ఒక సర్వనామం'], correct: 0 },
          ],
        },
      },
      {
        subject: 'social', name: 'భారతదేశ చరిత్ర', slug: 'bharatadesha-charitra-te',
        desc: 'NCERT 5వ తరగతి సామాజిక శాస్త్రం — ప్రాచీన నాగరికతల నుండి స్వాతంత్ర్య ఉద్యమం వరకు।',
        sections: [
          {
            title: 'ప్రాచీన భారతదేశం',
            lessons: [
              { title: 'సింధు లోయ నాగరికత', content: 'సింధు లోయ నాగరికత సుమారు 5000 సంవత్సరాల పురాతనమైనది, మొహెంజొదారో దాని ప్రధాన నగరం.' },
              { title: 'వేద కాలం', content: 'వేద కాలంలో వేదాలు రచించబడ్డాయి మరియు వ్యవసాయం ప్రధాన వృత్తి.' },
            ],
            topics: [
              { title: 'మొహెంజొదారో ఆవిష్కరణ', content: 'మొహెంజొదారోలో నగర ప్రణాళిక, స్నానవాటిక మరియు నీటి పారుదల వ్యవస్థ కనుగొనబడింది.' },
              { title: 'మ్యాప్ కార్యకలాపం', content: 'భారతదేశ మ్యాప్‌పై సింధు లోయ ప్రధాన ప్రదేశాలను గుర్తించండి.' },
            ],
          },
          {
            title: 'స్వాతంత్ర్య ఉద్యమం',
            lessons: [
              { title: 'మహాత్మా గాంధీ మరియు అహింస', content: 'గాంధీ గారు సత్యం మరియు అహింస మార్గంలో భారతదేశానికి స్వాతంత్ర్యం సాధించారు.' },
              { title: '1947: స్వాతంత్ర్య దినం', content: '1947 ఆగస్ట్ 15న భారతదేశం బ్రిటిష్ పాలన నుండి స్వాతంత్ర్యం పొందింది.' },
            ],
            topics: [
              { title: 'ఉప్పు సత్యాగ్రహం', content: '1930లో గాంధీ గారు దండి యాత్ర చేసి ఉప్పు చట్టాన్ని ఉల్లంఘించారు.' },
              { title: 'కాలరేఖ: స్వాతంత్ర్య దశలు', content: '1857 తిరుగుబాటు, సహాయ నిరాకరణ ఉద్యమం, క్విట్ ఇండియా — ముఖ్య సంఘటనలను క్రమంలో పెట్టండి.' },
            ],
          },
        ],
        quiz: {
          title: 'భారతదేశ చరిత్ర క్విజ్',
          questions: [
            { q: 'భారతదేశంలో అత్యంత పొడవైన నది ఏది?', opts: ['గంగా', 'యమునా', 'గోదావరి', 'నర్మదా'], correct: 0 },
            { q: 'భారతదేశ మొదటి ప్రధాన మంత్రి ఎవరు?', opts: ['జవహర్‌లాల్ నెహ్రూ', 'మహాత్మా గాంధీ', 'సర్దార్ పటేల్', 'బి.ఆర్. అంబేద్కర్'], correct: 0 },
            { q: 'భారతదేశ రాజధాని ఏది?', opts: ['న్యూ ఢిల్లీ', 'ముంబై', 'కోల్‌కతా', 'చెన్నై'], correct: 0 },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // ENGLISH (en)
  // -------------------------------------------------------------------------
  {
    code: 'en',
    courses: [
      {
        subject: 'maths', name: 'Geometry & Shapes', slug: 'geometry-and-shapes-en',
        desc: 'NCERT Class 5 Maths — learn about triangles, circles and 3D shapes with fun examples.',
        sections: [
          {
            title: '2D Shapes',
            lessons: [
              { title: 'Triangles and Quadrilaterals', content: 'A triangle has 3 sides. A quadrilateral has 4 sides. Squares and rectangles are quadrilaterals.' },
              { title: 'Circles and Their Parts', content: 'A circle has a centre, radius and diameter. The diameter is twice the radius.' },
            ],
            topics: [
              { title: 'Properties of 2D Shapes', content: 'Each shape has specific properties like number of sides, angles and symmetry lines.' },
              { title: 'Practice: Identify the Shapes', content: 'Look at the figures below and name each shape along with its number of sides.' },
            ],
          },
          {
            title: '3D Shapes',
            lessons: [
              { title: 'Cubes and Cuboids', content: 'A cube has 6 equal square faces. A cuboid has 6 rectangular faces.' },
              { title: 'Spheres, Cones and Cylinders', content: 'A sphere is perfectly round. A cone has one flat base and a pointed top.' },
            ],
            topics: [
              { title: 'Faces, Edges and Vertices', content: 'A cube has 6 faces, 12 edges and 8 vertices.' },
              { title: 'Activity: Find 3D Shapes Around You', content: 'List five objects at home that are shaped like a cube, cylinder or sphere.' },
            ],
          },
        ],
        quiz: {
          title: 'Geometry & Shapes Quiz',
          questions: [
            { q: 'How many sides does a triangle have?', opts: ['3', '4', '5', '6'], correct: 0 },
            { q: 'What is the diameter if the radius is 5 cm?', opts: ['10 cm', '5 cm', '15 cm', '25 cm'], correct: 0 },
            { q: 'How many faces does a cube have?', opts: ['6', '4', '8', '12'], correct: 0 },
          ],
        },
      },
      {
        subject: 'science', name: 'The Water Cycle', slug: 'water-cycle-en',
        desc: 'NCERT Class 5 Science — evaporation, condensation and precipitation explained simply.',
        sections: [
          {
            title: 'Evaporation & Condensation',
            lessons: [
              { title: 'What is Evaporation?', content: 'Evaporation is when water turns into vapour due to heat from the sun.' },
              { title: 'What is Condensation?', content: 'Condensation is when water vapour cools and turns back into tiny water droplets forming clouds.' },
            ],
            topics: [
              { title: 'How the Sun Drives Evaporation', content: 'The sun heats water in rivers, lakes and oceans, turning it into invisible water vapour.' },
              { title: 'Experiment: Evaporation in Action', content: 'Place a wet cloth in the sun and another in the shade. Observe which dries faster.' },
            ],
          },
          {
            title: 'Rain & Water Sources',
            lessons: [
              { title: 'How Rain Forms', content: 'When clouds become heavy with water droplets, the water falls as rain.' },
              { title: 'Sources of Fresh Water', content: 'Rivers, lakes, glaciers and underground water are our main sources of fresh water.' },
            ],
            topics: [
              { title: 'Types of Precipitation', content: 'Precipitation can fall as rain, snow, sleet or hail depending on temperature.' },
              { title: 'Activity: Draw the Water Cycle', content: 'Draw and label the four stages: evaporation, condensation, precipitation and collection.' },
            ],
          },
        ],
        quiz: {
          title: 'The Water Cycle Quiz',
          questions: [
            { q: 'What causes evaporation?', opts: ['Heat from the sun', 'Wind', 'Gravity', 'Moonlight'], correct: 0 },
            { q: 'What forms when water vapour condenses?', opts: ['Clouds', 'Rivers', 'Ice', 'Soil'], correct: 0 },
            { q: 'What is precipitation?', opts: ['Water falling from clouds', 'Water evaporating', 'Water freezing', 'Water filtering'], correct: 0 },
          ],
        },
      },
      {
        subject: 'language', name: 'Creative Writing', slug: 'creative-writing-en',
        desc: 'NCERT Class 5 English — storytelling, essays and letter writing practice.',
        sections: [
          {
            title: 'Story Writing',
            lessons: [
              { title: 'Elements of a Story', content: 'Every story has characters, a setting, a problem and a solution.' },
              { title: 'Writing a Short Story', content: 'Start with an interesting opening, build up the action and end with a conclusion.' },
            ],
            topics: [
              { title: 'Creating Characters', content: 'Give your characters names, traits and motivations so readers can relate to them.' },
              { title: 'Practice: Write a Story Opening', content: 'Write the first paragraph of a story set in a forest. Introduce one character and a problem.' },
            ],
          },
          {
            title: 'Essay & Letter Writing',
            lessons: [
              { title: 'Writing a Simple Essay', content: 'An essay has an introduction, body paragraphs and a conclusion.' },
              { title: 'Formal and Informal Letters', content: 'Formal letters use polite language and follow a set format with address, date and subject.' },
            ],
            topics: [
              { title: 'Paragraph Structure', content: 'Each paragraph should have one main idea, supporting sentences and a closing sentence.' },
              { title: 'Practice: Write a Letter', content: 'Write a letter to your friend describing your favourite holiday.' },
            ],
          },
        ],
        quiz: {
          title: 'Creative Writing Quiz',
          questions: [
            { q: 'What is a noun?', opts: ['A naming word', 'An action word', 'A describing word', 'A joining word'], correct: 0 },
            { q: 'What is the purpose of punctuation?', opts: ['To make text clear', 'To make text longer', 'To add colour', 'To remove words'], correct: 0 },
            { q: 'What is a synonym?', opts: ['A word with similar meaning', 'A word with opposite meaning', 'A type of verb', 'A pronoun'], correct: 0 },
          ],
        },
      },
      {
        subject: 'social', name: 'Geography of India', slug: 'geography-of-india-en',
        desc: 'NCERT Class 5 Social Studies — rivers, mountains and states of India.',
        sections: [
          {
            title: 'Rivers & Mountains',
            lessons: [
              { title: 'Major Rivers of India', content: 'The Ganga, Yamuna, Brahmaputra and Godavari are some of the major rivers of India.' },
              { title: 'The Himalayan Range', content: 'The Himalayas are the highest mountain range in the world and form the northern border of India.' },
            ],
            topics: [
              { title: 'River Systems and Tributaries', content: 'A river system includes the main river and all its tributaries that feed into it.' },
              { title: 'Map Activity: Mark the Rivers', content: 'On the map of India, mark the Ganga, Yamuna, Godavari, Krishna and Narmada rivers.' },
            ],
          },
          {
            title: 'States & Capitals',
            lessons: [
              { title: 'Northern and Southern States', content: 'India has 28 states and 8 union territories. Each state has its own capital city.' },
              { title: 'Union Territories', content: 'Union territories like Delhi, Chandigarh and Puducherry are governed directly by the central government.' },
            ],
            topics: [
              { title: 'State Boundaries and Neighbours', content: 'Each state shares boundaries with other states. For example, UP borders MP, Rajasthan and Bihar.' },
              { title: 'Activity: Match States and Capitals', content: 'Match each state with its correct capital: Maharashtra-Mumbai, Karnataka-Bengaluru, Tamil Nadu-Chennai.' },
            ],
          },
        ],
        quiz: {
          title: 'Geography of India Quiz',
          questions: [
            { q: 'Which river is the longest in India?', opts: ['Ganga', 'Yamuna', 'Godavari', 'Narmada'], correct: 0 },
            { q: 'Who was the first Prime Minister of India?', opts: ['Jawaharlal Nehru', 'Mahatma Gandhi', 'Sardar Patel', 'B.R. Ambedkar'], correct: 0 },
            { q: 'What is the capital of India?', opts: ['New Delhi', 'Mumbai', 'Kolkata', 'Chennai'], correct: 0 },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // GUJARATI (gu)
  // -------------------------------------------------------------------------
  {
    code: 'gu',
    courses: [
      {
        subject: 'maths', name: 'અપૂર્ણાંક અને દશાંશ', slug: 'apurnank-ane-dashansh-gu',
        desc: 'NCERT ધોરણ 5 ગણિત — અપૂર્ણાંક, દશાંશ અને સંખ્યા જ્ઞાન ગુજરાતીમાં શીખો.',
        sections: [
          {
            title: 'અપૂર્ણાંકનો પરિચય',
            lessons: [
              { title: 'અપૂર્ણાંક શું છે?', content: 'અપૂર્ણાંક એ સંપૂર્ણ સંખ્યાનો એક ભાગ છે. ઉદાહરણ: 1/2 એટલે અડધું.' },
              { title: 'અંશ અને છેદ', content: 'ઉપરની સંખ્યાને અંશ અને નીચેની સંખ્યાને છેદ કહે છે.' },
            ],
            topics: [
              { title: 'અપૂર્ણાંક સમજવું', content: 'અપૂર્ણાંક એટલે આખાનો એક ભાગ. એક રોટલીના બે સરખા ભાગ કરો તો દરેક ભાગ 1/2 છે.' },
              { title: 'અભ્યાસ: અપૂર્ણાંક ઓળખો', content: 'નીચેની આકૃતિઓમાં રંગેલા ભાગને અપૂર્ણાંક રૂપે લખો.' },
            ],
          },
          {
            title: 'દશાંશ સંખ્યાઓ',
            lessons: [
              { title: 'દશાંશનો પરિચય', content: 'દશાંશ બિંદુ પછીના અંકો દસમા, સોમા ભાગ દર્શાવે છે.' },
              { title: 'દશાંશ સરવાળો અને બાદબાકી', content: 'દશાંશ બિંદુને એક લીટીમાં રાખીને સરવાળો કે બાદબાકી કરો.' },
            ],
            topics: [
              { title: 'દશાંશ સ્થાન મૂલ્ય', content: 'દશાંશ બિંદુની જમણી બાજુનું પ્રથમ સ્થાન દસમો ભાગ અને બીજું સોમો ભાગ છે.' },
              { title: 'અભ્યાસ: દશાંશ રૂપાંતરણ', content: 'અપૂર્ણાંક 1/4 ને દશાંશમાં બદલો: 1÷4 = 0.25.' },
            ],
          },
        ],
        quiz: {
          title: 'અપૂર્ણાંક અને દશાંશ પ્રશ્નોત્તરી',
          questions: [
            { q: 'અપૂર્ણાંક 3/4 માં છેદ શું છે?', opts: ['4', '3', '7', '1'], correct: 0 },
            { q: '0.5 ને અપૂર્ણાંકમાં કેવી રીતે લખશો?', opts: ['1/2', '1/3', '1/4', '1/5'], correct: 0 },
            { q: '1/2 + 1/4 કેટલું થાય?', opts: ['3/4', '2/4', '1/6', '2/6'], correct: 0 },
          ],
        },
      },
      {
        subject: 'science', name: 'છોડ અને પ્રકાશસંશ્લેષણ', slug: 'chhod-ane-prakash-gu',
        desc: 'NCERT ધોરણ 5 વિજ્ઞાન — છોડ કેવી રીતે ખોરાક બનાવે છે ગુજરાતીમાં સમજો.',
        sections: [
          {
            title: 'પ્રકાશસંશ્લેષણની મૂળભૂત બાબતો',
            lessons: [
              { title: 'પ્રકાશસંશ્લેષણ એટલે શું?', content: 'છોડ સૂર્યપ્રકાશ, પાણી અને કાર્બન ડાયોક્સાઇડમાંથી પોતાનો ખોરાક બનાવે છે.' },
              { title: 'પાંદડાની ભૂમિકા', content: 'પાંદડામાં ક્લોરોફિલ હોય છે જે પ્રકાશસંશ્લેષણમાં મદદ કરે છે.' },
            ],
            topics: [
              { title: 'ક્લોરોફિલ અને લીલો રંગ', content: 'ક્લોરોફિલ એક લીલું રંગદ્રવ્ય છે જે સૂર્યપ્રકાશ શોષે છે.' },
              { title: 'પ્રયોગ: પાંદડામાં સ્ટાર્ચ', content: 'આયોડિન પરીક્ષણ દ્વારા પાંદડામાં સ્ટાર્ચ છે કે નહીં તપાસો.' },
            ],
          },
          {
            title: 'છોડનું જીવન ચક્ર',
            lessons: [
              { title: 'બીજમાંથી છોડ', content: 'બીજ અંકુરિત થઈને મૂળ, દાંડી અને પાંદડા બનાવે છે.' },
              { title: 'પરાગનયન અને ફળ', content: 'ફૂલોમાં પરાગનયન પછી ફળ અને બીજ બને છે.' },
            ],
            topics: [
              { title: 'અંકુરણની પ્રક્રિયા', content: 'બીજને ભેજ, ગરમી અને હવા મળે ત્યારે અંકુરણ થાય છે.' },
              { title: 'પ્રવૃત્તિ: બીજ ઉગાડવું', content: 'ભીના રૂ પર મગના બીજ મૂકીને 5 દિવસ સુધી નિરીક્ષણ કરો.' },
            ],
          },
        ],
        quiz: {
          title: 'છોડ અને પ્રકાશસંશ્લેષણ પ્રશ્નોત્તરી',
          questions: [
            { q: 'પ્રકાશસંશ્લેષણમાં છોડ કયો વાયુ શોષે છે?', opts: ['કાર્બન ડાયોક્સાઇડ', 'ઓક્સિજન', 'નાઇટ્રોજન', 'હાઇડ્રોજન'], correct: 0 },
            { q: 'છોડનો કયો ભાગ ખોરાક બનાવે છે?', opts: ['પાંદડું', 'મૂળ', 'દાંડી', 'ફૂલ'], correct: 0 },
            { q: 'પ્રકાશસંશ્લેષણ માટે શું જરૂરી છે?', opts: ['સૂર્યપ્રકાશ અને પાણી', 'માટી અને પવન', 'વરસાદ અને અગ્નિ', 'બરફ અને ઠંડી'], correct: 0 },
          ],
        },
      },
      {
        subject: 'language', name: 'ગુજરાતી વાંચન અને લેખન', slug: 'gujarati-vanchan-lekhan-gu',
        desc: 'NCERT ધોરણ 5 ગુજરાતી — વાંચવું, લખવું અને વ્યાકરણ અભ્યાસ.',
        sections: [
          {
            title: 'વાંચન કૌશલ્ય',
            lessons: [
              { title: 'વાર્તા વાંચવી', content: 'વાર્તા વાંચીને મુખ્ય પાત્ર, ઘટના અને સંદેશ ઓળખતા શીખો.' },
              { title: 'શબ્દભંડોળ વધારવો', content: 'નવા શબ્દોનો અર્થ જાણો અને વાક્યોમાં ઉપયોગ કરો.' },
            ],
            topics: [
              { title: 'મુખ્ય વિચાર શોધવો', content: 'કોઈ ફકરાનો મુખ્ય વિચાર એ બાબત છે જે આખો ફકરો કહેવા માંગે છે.' },
              { title: 'અભ્યાસ: પ્રશ્ન-જવાબ', content: 'આપેલી વાર્તા વાંચીને નીચેના પ્રશ્નોના જવાબ આપો.' },
            ],
          },
          {
            title: 'લેખન અને વ્યાકરણ',
            lessons: [
              { title: 'નામ અને સર્વનામ', content: 'નામ કોઈ વ્યક્તિ, વસ્તુ કે સ્થળનું નામ છે; સર્વનામ નામના બદલે વપરાય છે.' },
              { title: 'પત્ર લેખન', content: 'ઔપચારિક પત્રમાં મોકલનારનું સરનામું, તારીખ, વિષય અને અભિવાદન હોય છે.' },
            ],
            topics: [
              { title: 'ક્રિયાપદ અને વિશેષણ', content: 'ક્રિયાપદ ક્રિયા દર્શાવે છે અને વિશેષણ નામની વિશેષતા બતાવે છે.' },
              { title: 'અભ્યાસ: નિબંધ લખો', content: '"મારો પ્રિય તહેવાર" વિષય પર 10 વાક્યોનો નિબંધ લખો.' },
            ],
          },
        ],
        quiz: {
          title: 'ગુજરાતી વાંચન અને લેખન પ્રશ્નોત્તરી',
          questions: [
            { q: 'નામ (સંજ્ઞા) એટલે શું?', opts: ['વ્યક્તિ, વસ્તુ કે સ્થળનું નામ', 'ક્રિયાનું બીજું નામ', 'વિશેષણનો પ્રકાર', 'સર્વનામનો પર્યાય'], correct: 0 },
            { q: 'વિરામચિહ્નોનો ઉપયોગ શું છે?', opts: ['વાક્ય સ્પષ્ટ કરવું', 'વાક્ય લાંબું કરવું', 'રંગ ઉમેરવો', 'શબ્દો દૂર કરવા'], correct: 0 },
            { q: 'સમાનાર્થી શબ્દ એટલે શું?', opts: ['સરખા અર્થવાળો શબ્દ', 'વિરુદ્ધ અર્થવાળો શબ્દ', 'ક્રિયાનો પ્રકાર', 'એક સર્વનામ'], correct: 0 },
          ],
        },
      },
      {
        subject: 'social', name: 'ભારતનો ઇતિહાસ', slug: 'bharatno-itihas-gu',
        desc: 'NCERT ધોરણ 5 સામાજિક વિજ્ઞાન — પ્રાચીન સભ્યતાઓથી સ્વતંત્રતા ચળવળ સુધી.',
        sections: [
          {
            title: 'પ્રાચીન ભારત',
            lessons: [
              { title: 'સિંધુ ખીણ સભ્યતા', content: 'સિંધુ ખીણ સભ્યતા લગભગ 5000 વર્ષ જૂની છે અને મોહેંજોદડો તેનું મુખ્ય નગર હતું.' },
              { title: 'વૈદિક કાળ', content: 'વૈદિક કાળમાં વેદોની રચના થઈ અને ખેતી મુખ્ય વ્યવસાય હતો.' },
            ],
            topics: [
              { title: 'મોહેંજોદડોની શોધ', content: 'મોહેંજોદડોમાં નગર આયોજન, સ્નાનાગાર અને ગટર વ્યવસ્થા મળી આવ્યાં.' },
              { title: 'નકશા પ્રવૃત્તિ', content: 'ભારતના નકશા પર સિંધુ ખીણના મુખ્ય સ્થળો ચિહ્નિત કરો.' },
            ],
          },
          {
            title: 'સ્વતંત્રતા ચળવળ',
            lessons: [
              { title: 'મહાત્મા ગાંધી અને અહિંસા', content: 'ગાંધીજીએ સત્ય અને અહિંસાના માર્ગે ભારતને સ્વતંત્રતા અપાવી.' },
              { title: '1947: સ્વતંત્રતા દિવસ', content: '15 ઓગસ્ટ 1947ના રોજ ભારત બ્રિટિશ શાસનથી સ્વતંત્ર થયું.' },
            ],
            topics: [
              { title: 'મીઠાનો સત્યાગ્રહ', content: '1930માં ગાંધીજીએ દાંડી યાત્રા કરીને મીઠાનો કાયદો તોડ્યો.' },
              { title: 'સમયરેખા: સ્વતંત્રતાના ચરણો', content: '1857નો બળવો, અસહકાર આંદોલન, ભારત છોડો આંદોલન — મુખ્ય ઘટનાઓને ક્રમમાં ગોઠવો.' },
            ],
          },
        ],
        quiz: {
          title: 'ભારતનો ઇતિહાસ પ્રશ્નોત્તરી',
          questions: [
            { q: 'ભારતની સૌથી લાંબી નદી કઈ છે?', opts: ['ગંગા', 'યમુના', 'ગોદાવરી', 'નર્મદા'], correct: 0 },
            { q: 'ભારતના પ્રથમ વડાપ્રધાન કોણ હતા?', opts: ['જવાહરલાલ નેહરુ', 'મહાત્મા ગાંધી', 'સરદાર પટેલ', 'બી.આર. આંબેડકર'], correct: 0 },
            { q: 'ભારતની રાજધાની શું છે?', opts: ['નવી દિલ્હી', 'મુંબઈ', 'કોલકાતા', 'ચેન્નાઈ'], correct: 0 },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // TAMIL (ta)
  // -------------------------------------------------------------------------
  {
    code: 'ta',
    courses: [
      {
        subject: 'maths', name: 'பின்னங்கள் மற்றும் தசமங்கள்', slug: 'pinnangal-thasamangal-ta',
        desc: 'NCERT 5ம் வகுப்பு கணிதம் — பின்னங்கள், தசமங்கள் தமிழில் கற்றுக்கொள்ளுங்கள்.',
        sections: [
          {
            title: 'பின்னங்கள் அறிமுகம்',
            lessons: [
              { title: 'பின்னம் என்றால் என்ன?', content: 'பின்னம் என்பது முழுவதன் ஒரு பகுதி. எடுத்துக்காட்டு: 1/2 என்றால் பாதி.' },
              { title: 'தொகுதி மற்றும் பகுதி', content: 'மேலே உள்ள எண் தொகுதி, கீழே உள்ள எண் பகுதி எனப்படும்.' },
            ],
            topics: [
              { title: 'பின்னங்களைப் புரிந்துகொள்ளுதல்', content: 'பின்னம் என்பது முழு பொருளின் ஒரு பகுதி. ஒரு ரொட்டியை இரண்டு சம பகுதிகளாகப் பிரித்தால் ஒவ்வொன்றும் 1/2.' },
              { title: 'பயிற்சி: பின்னங்களை அடையாளம் காணுங்கள்', content: 'கீழே உள்ள படங்களில் நிறம் தீட்டப்பட்ட பகுதியை பின்னமாக எழுதுங்கள்.' },
            ],
          },
          {
            title: 'தசம எண்கள்',
            lessons: [
              { title: 'தசமம் அறிமுகம்', content: 'தசம புள்ளிக்குப் பின் உள்ள இலக்கங்கள் பத்தில் ஒரு பங்கு, நூறில் ஒரு பங்கு ஆகியவற்றைக் குறிக்கும்.' },
              { title: 'தசமக் கூட்டல் மற்றும் கழித்தல்', content: 'தசம புள்ளிகளை ஒரே வரிசையில் வைத்துக் கூட்டவும் அல்லது கழிக்கவும்.' },
            ],
            topics: [
              { title: 'தசம இட மதிப்பு', content: 'தசம புள்ளியின் வலது பக்கம் முதல் இடம் பத்தில் ஒரு பங்கு, இரண்டாவது இடம் நூறில் ஒரு பங்கு.' },
              { title: 'பயிற்சி: தசம மாற்றம்', content: 'பின்னம் 1/4 ஐ தசமமாக மாற்றுங்கள்: 1÷4 = 0.25.' },
            ],
          },
        ],
        quiz: {
          title: 'பின்னங்கள் மற்றும் தசமங்கள் வினாடி வினா',
          questions: [
            { q: 'பின்னம் 3/4 இல் பகுதி என்ன?', opts: ['4', '3', '7', '1'], correct: 0 },
            { q: '0.5 ஐ பின்னமாக எப்படி எழுதுவீர்கள்?', opts: ['1/2', '1/3', '1/4', '1/5'], correct: 0 },
            { q: '1/2 + 1/4 எவ்வளவு?', opts: ['3/4', '2/4', '1/6', '2/6'], correct: 0 },
          ],
        },
      },
      {
        subject: 'science', name: 'தாவரங்கள் மற்றும் ஒளிச்சேர்க்கை', slug: 'thavarangal-olicheerkai-ta',
        desc: 'NCERT 5ம் வகுப்பு அறிவியல் — தாவரங்கள் எவ்வாறு உணவு தயாரிக்கின்றன தமிழில் புரிந்துகொள்ளுங்கள்.',
        sections: [
          {
            title: 'ஒளிச்சேர்க்கை அடிப்படைகள்',
            lessons: [
              { title: 'ஒளிச்சேர்க்கை என்றால் என்ன?', content: 'தாவரங்கள் சூரிய ஒளி, நீர் மற்றும் கரியமில வாயு மூலம் தங்கள் உணவைத் தயாரிக்கின்றன.' },
              { title: 'இலைகளின் பங்கு', content: 'இலைகளில் பசுங்கணிகம் (குளோரோஃபில்) உள்ளது, இது ஒளிச்சேர்க்கையில் உதவுகிறது.' },
            ],
            topics: [
              { title: 'பசுங்கணிகம் மற்றும் பச்சை நிறம்', content: 'பசுங்கணிகம் ஒரு பச்சை நிறமி, இது சூரிய ஒளியை உறிஞ்சுகிறது.' },
              { title: 'சோதனை: இலையில் மாவுச்சத்து', content: 'அயோடின் சோதனை மூலம் இலையில் மாவுச்சத்து உள்ளதா எனச் சரிபாருங்கள்.' },
            ],
          },
          {
            title: 'தாவர வாழ்க்கைச் சுழற்சி',
            lessons: [
              { title: 'விதையிலிருந்து தாவரம்', content: 'விதை முளைத்து வேர், தண்டு மற்றும் இலைகள் உருவாகின்றன.' },
              { title: 'மகரந்தச் சேர்க்கையும் கனிகளும்', content: 'பூக்களில் மகரந்தச் சேர்க்கைக்குப் பிறகு கனிகளும் விதைகளும் உருவாகின்றன.' },
            ],
            topics: [
              { title: 'முளைத்தல் செயல்முறை', content: 'விதைக்கு ஈரம், வெப்பம் மற்றும் காற்று கிடைக்கும்போது முளைத்தல் நிகழ்கிறது.' },
              { title: 'செயல்பாடு: விதைகளை நடுதல்', content: 'ஈரமான பருத்தி மீது பாசிப்பயறு விதைகளை வைத்து 5 நாட்கள் கவனியுங்கள்.' },
            ],
          },
        ],
        quiz: {
          title: 'தாவரங்கள் மற்றும் ஒளிச்சேர்க்கை வினாடி வினா',
          questions: [
            { q: 'ஒளிச்சேர்க்கையில் தாவரங்கள் எந்த வாயுவை உறிஞ்சுகின்றன?', opts: ['கரியமில வாயு', 'ஆக்சிஜன்', 'நைட்ரஜன்', 'ஹைட்ரஜன்'], correct: 0 },
            { q: 'தாவரத்தின் எந்தப் பகுதி உணவு தயாரிக்கிறது?', opts: ['இலை', 'வேர்', 'தண்டு', 'பூ'], correct: 0 },
            { q: 'ஒளிச்சேர்க்கைக்கு என்ன தேவை?', opts: ['சூரிய ஒளி மற்றும் நீர்', 'மண் மற்றும் காற்று', 'மழை மற்றும் நெருப்பு', 'பனி மற்றும் குளிர்'], correct: 0 },
          ],
        },
      },
      {
        subject: 'language', name: 'தமிழ் வாசிப்பு மற்றும் எழுத்து', slug: 'tamil-vasippu-ezhuthu-ta',
        desc: 'NCERT 5ம் வகுப்பு தமிழ் — வாசிப்பு, எழுத்து மற்றும் இலக்கணப் பயிற்சி.',
        sections: [
          {
            title: 'வாசிப்புத் திறன்கள்',
            lessons: [
              { title: 'கதை வாசித்தல்', content: 'கதை வாசித்து முக்கிய கதாபாத்திரம், நிகழ்வு மற்றும் செய்தியை அடையாளம் காணக் கற்றுக்கொள்ளுங்கள்.' },
              { title: 'சொல்வளம் பெருக்குதல்', content: 'புதிய சொற்களின் பொருள் அறிந்து வாக்கியங்களில் பயன்படுத்துங்கள்.' },
            ],
            topics: [
              { title: 'முக்கிய கருத்தைக் கண்டறிதல்', content: 'ஒரு பத்தியின் முக்கிய கருத்து என்பது முழுப் பத்தியும் சொல்ல விரும்புவது.' },
              { title: 'பயிற்சி: கேள்வி-பதில்', content: 'கொடுக்கப்பட்ட கதையை வாசித்துக் கீழே உள்ள கேள்விகளுக்குப் பதில் எழுதுங்கள்.' },
            ],
          },
          {
            title: 'எழுத்து மற்றும் இலக்கணம்',
            lessons: [
              { title: 'பெயர்ச்சொல் மற்றும் பிரதிப்பெயர்', content: 'பெயர்ச்சொல் ஒரு நபர், பொருள் அல்லது இடத்தின் பெயர்; பிரதிப்பெயர் பெயர்ச்சொல்லுக்கு பதிலாக வரும்.' },
              { title: 'கடிதம் எழுதுதல்', content: 'முறையான கடிதத்தில் அனுப்புநர் முகவரி, தேதி, பொருள் மற்றும் வணக்கம் இருக்கும்.' },
            ],
            topics: [
              { title: 'வினைச்சொல் மற்றும் பெயரடை', content: 'வினைச்சொல் செயலைக் குறிக்கும், பெயரடை பெயர்ச்சொல்லின் தன்மையை விவரிக்கும்.' },
              { title: 'பயிற்சி: கட்டுரை எழுதுங்கள்', content: '"எனக்குப் பிடித்த திருவிழா" என்ற தலைப்பில் 10 வாக்கியக் கட்டுரை எழுதுங்கள்.' },
            ],
          },
        ],
        quiz: {
          title: 'தமிழ் வாசிப்பு மற்றும் எழுத்து வினாடி வினா',
          questions: [
            { q: 'பெயர்ச்சொல் என்றால் என்ன?', opts: ['நபர், பொருள் அல்லது இடத்தின் பெயர்', 'வினையின் மறு பெயர்', 'பெயரடை வகை', 'பிரதிப்பெயரின் இணை'], correct: 0 },
            { q: 'நிறுத்தக் குறிகளின் பயன் என்ன?', opts: ['வாக்கியத்தைத் தெளிவாக்குவது', 'வாக்கியத்தை நீட்டிப்பது', 'நிறம் சேர்ப்பது', 'சொற்களை நீக்குவது'], correct: 0 },
            { q: 'ஒத்தசொல் என்றால் என்ன?', opts: ['ஒரே பொருள் கொண்ட சொல்', 'எதிர்ப்பொருள் கொண்ட சொல்', 'வினையின் வகை', 'ஒரு பிரதிப்பெயர்'], correct: 0 },
          ],
        },
      },
      {
        subject: 'social', name: 'இந்திய வரலாறு', slug: 'indhiya-varalaru-ta',
        desc: 'NCERT 5ம் வகுப்பு சமூக அறிவியல் — பண்டைய நாகரிகங்கள் முதல் சுதந்திர இயக்கம் வரை.',
        sections: [
          {
            title: 'பண்டைய இந்தியா',
            lessons: [
              { title: 'சிந்து சமவெளி நாகரிகம்', content: 'சிந்து சமவெளி நாகரிகம் சுமார் 5000 ஆண்டுகள் பழமையானது, மொகஞ்சதாரோ அதன் முக்கிய நகரம்.' },
              { title: 'வேத காலம்', content: 'வேத காலத்தில் வேதங்கள் இயற்றப்பட்டன, வேளாண்மை முக்கிய தொழிலாக இருந்தது.' },
            ],
            topics: [
              { title: 'மொகஞ்சதாரோ கண்டுபிடிப்பு', content: 'மொகஞ்சதாரோவில் நகர திட்டமிடல், குளியலறை மற்றும் வடிகால் அமைப்பு கண்டறியப்பட்டன.' },
              { title: 'வரைபடச் செயல்பாடு', content: 'இந்திய வரைபடத்தில் சிந்து சமவெளியின் முக்கிய இடங்களைக் குறிக்கவும்.' },
            ],
          },
          {
            title: 'சுதந்திர இயக்கம்',
            lessons: [
              { title: 'மகாத்மா காந்தி மற்றும் அகிம்சை', content: 'காந்தியடிகள் உண்மை மற்றும் அகிம்சை வழியில் இந்தியாவுக்கு சுதந்திரம் பெற்றுத் தந்தார்.' },
              { title: '1947: சுதந்திர தினம்', content: '1947 ஆகஸ்ட் 15 அன்று இந்தியா பிரிட்டிஷ் ஆட்சியிலிருந்து சுதந்திரம் பெற்றது.' },
            ],
            topics: [
              { title: 'உப்பு சத்தியாகிரகம்', content: '1930 இல் காந்தியடிகள் தண்டி யாத்திரை மேற்கொண்டு உப்புச் சட்டத்தை மீறினார்.' },
              { title: 'காலவரிசை: சுதந்திரப் படிநிலைகள்', content: '1857 கிளர்ச்சி, ஒத்துழையாமை இயக்கம், வெள்ளையனே வெளியேறு — முக்கிய நிகழ்வுகளை வரிசைப்படுத்துங்கள்.' },
            ],
          },
        ],
        quiz: {
          title: 'இந்திய வரலாறு வினாடி வினா',
          questions: [
            { q: 'இந்தியாவின் நீளமான நதி எது?', opts: ['கங்கை', 'யமுனா', 'கோதாவரி', 'நர்மதா'], correct: 0 },
            { q: 'இந்தியாவின் முதல் பிரதமர் யார்?', opts: ['ஜவஹர்லால் நேரு', 'மகாத்மா காந்தி', 'சர்தார் படேல்', 'பி.ஆர். அம்பேத்கர்'], correct: 0 },
            { q: 'இந்தியாவின் தலைநகரம் எது?', opts: ['புது தில்லி', 'மும்பை', 'கொல்கத்தா', 'சென்னை'], correct: 0 },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // MARATHI (mr)
  // -------------------------------------------------------------------------
  {
    code: 'mr',
    courses: [
      {
        subject: 'maths', name: 'अपूर्णांक आणि दशांश', slug: 'apurnank-ani-dashansh-mr',
        desc: 'NCERT इयत्ता 5 गणित — अपूर्णांक, दशांश आणि संख्या ज्ञान मराठीत शिका.',
        sections: [
          {
            title: 'अपूर्णांकांचा परिचय',
            lessons: [
              { title: 'अपूर्णांक म्हणजे काय?', content: 'अपूर्णांक म्हणजे संपूर्ण संख्येचा एक भाग. उदाहरण: 1/2 म्हणजे अर्धा.' },
              { title: 'अंश आणि छेद', content: 'वरची संख्या अंश आणि खालची संख्या छेद असते.' },
            ],
            topics: [
              { title: 'अपूर्णांक समजून घेणे', content: 'अपूर्णांक म्हणजे संपूर्णाचा एक भाग. एका रोटीचे दोन समान भाग केले तर प्रत्येक भाग 1/2 आहे.' },
              { title: 'सराव: अपूर्णांक ओळखा', content: 'खालील आकृत्यांमधील रंगीत भाग अपूर्णांक स्वरूपात लिहा.' },
            ],
          },
          {
            title: 'दशांश संख्या',
            lessons: [
              { title: 'दशांशाचा परिचय', content: 'दशांश बिंदूनंतरचे अंक दशमांश, शतमांश भाग दर्शवतात.' },
              { title: 'दशांश बेरीज आणि वजाबाकी', content: 'दशांश बिंदू एका रांगेत ठेवून बेरीज किंवा वजाबाकी करा.' },
            ],
            topics: [
              { title: 'दशांश स्थान मूल्य', content: 'दशांश बिंदूच्या उजव्या बाजूचे पहिले स्थान दशमांश आणि दुसरे शतमांश असते.' },
              { title: 'सराव: दशांश रूपांतर', content: 'अपूर्णांक 1/4 दशांशात बदला: 1÷4 = 0.25.' },
            ],
          },
        ],
        quiz: {
          title: 'अपूर्णांक आणि दशांश प्रश्नमंजुषा',
          questions: [
            { q: 'अपूर्णांक 3/4 मध्ये छेद काय आहे?', opts: ['4', '3', '7', '1'], correct: 0 },
            { q: '0.5 अपूर्णांकात कसे लिहाल?', opts: ['1/2', '1/3', '1/4', '1/5'], correct: 0 },
            { q: '1/2 + 1/4 किती होते?', opts: ['3/4', '2/4', '1/6', '2/6'], correct: 0 },
          ],
        },
      },
      {
        subject: 'science', name: 'वनस्पती आणि प्रकाशसंश्लेषण', slug: 'vanaspati-ani-prakash-mr',
        desc: 'NCERT इयत्ता 5 विज्ञान — वनस्पती अन्न कसे बनवतात मराठीत समजून घ्या.',
        sections: [
          {
            title: 'प्रकाशसंश्लेषणाच्या मूलभूत गोष्टी',
            lessons: [
              { title: 'प्रकाशसंश्लेषण म्हणजे काय?', content: 'वनस्पती सूर्यप्रकाश, पाणी आणि कार्बन डायऑक्साइडपासून अन्न तयार करतात.' },
              { title: 'पानांची भूमिका', content: 'पानांमध्ये हरितद्रव्य (क्लोरोफिल) असते जे प्रकाशसंश्लेषणात मदत करते.' },
            ],
            topics: [
              { title: 'हरितद्रव्य आणि हिरवा रंग', content: 'हरितद्रव्य हे हिरव्या रंगाचे द्रव्य आहे जे सूर्यप्रकाश शोषून घेते.' },
              { title: 'प्रयोग: पानातील स्टार्च', content: 'आयोडीन चाचणीद्वारे पानात स्टार्च आहे का ते तपासा.' },
            ],
          },
          {
            title: 'वनस्पतींचे जीवनचक्र',
            lessons: [
              { title: 'बीजापासून वनस्पती', content: 'बीज अंकुरित होऊन मूळ, खोड आणि पाने तयार होतात.' },
              { title: 'परागीकरण आणि फळ', content: 'फुलांमध्ये परागीकरणानंतर फळ आणि बीज तयार होतात.' },
            ],
            topics: [
              { title: 'अंकुरणाची प्रक्रिया', content: 'बीजाला ओलावा, उष्णता आणि हवा मिळाली की अंकुरण होते.' },
              { title: 'कृती: बीज रुजवणे', content: 'ओल्या कापसावर मुगाचे बीज ठेवून 5 दिवस निरीक्षण करा.' },
            ],
          },
        ],
        quiz: {
          title: 'वनस्पती आणि प्रकाशसंश्लेषण प्रश्नमंजुषा',
          questions: [
            { q: 'प्रकाशसंश्लेषणात वनस्पती कोणता वायू शोषतात?', opts: ['कार्बन डायऑक्साइड', 'ऑक्सिजन', 'नायट्रोजन', 'हायड्रोजन'], correct: 0 },
            { q: 'वनस्पतीचा कोणता भाग अन्न बनवतो?', opts: ['पान', 'मूळ', 'खोड', 'फूल'], correct: 0 },
            { q: 'प्रकाशसंश्लेषणासाठी काय आवश्यक आहे?', opts: ['सूर्यप्रकाश आणि पाणी', 'माती आणि वारा', 'पाऊस आणि अग्नी', 'बर्फ आणि थंडी'], correct: 0 },
          ],
        },
      },
      {
        subject: 'language', name: 'मराठी वाचन आणि लेखन', slug: 'marathi-vachan-lekhan-mr',
        desc: 'NCERT इयत्ता 5 मराठी — वाचन, लेखन आणि व्याकरण सराव.',
        sections: [
          {
            title: 'वाचन कौशल्ये',
            lessons: [
              { title: 'गोष्ट वाचणे', content: 'गोष्ट वाचून मुख्य पात्र, घटना आणि संदेश ओळखायला शिका.' },
              { title: 'शब्दसंग्रह वाढवणे', content: 'नवीन शब्दांचे अर्थ जाणून घ्या आणि वाक्यांत वापरा.' },
            ],
            topics: [
              { title: 'मुख्य विचार शोधणे', content: 'एखाद्या परिच्छेदाचा मुख्य विचार म्हणजे संपूर्ण परिच्छेद काय सांगू इच्छितो ते.' },
              { title: 'सराव: प्रश्न-उत्तरे', content: 'दिलेली गोष्ट वाचून खालील प्रश्नांची उत्तरे लिहा.' },
            ],
          },
          {
            title: 'लेखन आणि व्याकरण',
            lessons: [
              { title: 'नाम आणि सर्वनाम', content: 'नाम म्हणजे कोणत्याही व्यक्ती, वस्तू किंवा ठिकाणाचे नाव; सर्वनाम नामाऐवजी येतो.' },
              { title: 'पत्र लेखन', content: 'औपचारिक पत्रात प्रेषकाचा पत्ता, दिनांक, विषय आणि अभिवादन असते.' },
            ],
            topics: [
              { title: 'क्रियापद आणि विशेषण', content: 'क्रियापद कृती दर्शवते आणि विशेषण नामाचे गुणधर्म सांगते.' },
              { title: 'सराव: निबंध लिहा', content: '"माझा आवडता सण" या विषयावर 10 वाक्यांचा निबंध लिहा.' },
            ],
          },
        ],
        quiz: {
          title: 'मराठी वाचन आणि लेखन प्रश्नमंजुषा',
          questions: [
            { q: 'नाम (संज्ञा) म्हणजे काय?', opts: ['व्यक्ती, वस्तू किंवा ठिकाणाचे नाव', 'क्रियेचे दुसरे नाव', 'विशेषणाचा प्रकार', 'सर्वनामाचा पर्याय'], correct: 0 },
            { q: 'विरामचिन्हांचा उपयोग काय?', opts: ['वाक्य स्पष्ट करणे', 'वाक्य लांबवणे', 'रंग जोडणे', 'शब्द काढणे'], correct: 0 },
            { q: 'समानार्थी शब्द म्हणजे काय?', opts: ['सारख्या अर्थाचा शब्द', 'विरुद्ध अर्थाचा शब्द', 'क्रियापदाचा प्रकार', 'एक सर्वनाम'], correct: 0 },
          ],
        },
      },
      {
        subject: 'social', name: 'भारताचा इतिहास', slug: 'bharatacha-itihas-mr',
        desc: 'NCERT इयत्ता 5 सामाजिक शास्त्र — प्राचीन संस्कृतींपासून स्वातंत्र्य चळवळीपर्यंत.',
        sections: [
          {
            title: 'प्राचीन भारत',
            lessons: [
              { title: 'सिंधू खोरे संस्कृती', content: 'सिंधू खोरे संस्कृती सुमारे 5000 वर्षे जुनी आहे आणि मोहेंजोदडो तिचे प्रमुख नगर होते.' },
              { title: 'वैदिक काळ', content: 'वैदिक काळात वेदांची रचना झाली आणि शेती हा प्रमुख व्यवसाय होता.' },
            ],
            topics: [
              { title: 'मोहेंजोदडोचा शोध', content: 'मोहेंजोदडोमध्ये नगर नियोजन, स्नानगृह आणि गटार व्यवस्था सापडली.' },
              { title: 'नकाशा कृती', content: 'भारताच्या नकाशावर सिंधू खोऱ्यातील प्रमुख स्थळे चिन्हांकित करा.' },
            ],
          },
          {
            title: 'स्वातंत्र्य चळवळ',
            lessons: [
              { title: 'महात्मा गांधी आणि अहिंसा', content: 'गांधीजींनी सत्य आणि अहिंसेच्या मार्गाने भारताला स्वातंत्र्य मिळवून दिले.' },
              { title: '1947: स्वातंत्र्य दिन', content: '15 ऑगस्ट 1947 रोजी भारत ब्रिटिश राजवटीतून स्वतंत्र झाला.' },
            ],
            topics: [
              { title: 'मिठाचा सत्याग्रह', content: '1930 मध्ये गांधीजींनी दांडी यात्रा करून मिठाचा कायदा मोडला.' },
              { title: 'कालरेषा: स्वातंत्र्याचे टप्पे', content: '1857 चा उठाव, असहकार चळवळ, भारत छोडो चळवळ — प्रमुख घटनांना क्रमाने लावा.' },
            ],
          },
        ],
        quiz: {
          title: 'भारताचा इतिहास प्रश्नमंजुषा',
          questions: [
            { q: 'भारतातील सर्वात लांब नदी कोणती?', opts: ['गंगा', 'यमुना', 'गोदावरी', 'नर्मदा'], correct: 0 },
            { q: 'भारताचे पहिले पंतप्रधान कोण होते?', opts: ['जवाहरलाल नेहरू', 'महात्मा गांधी', 'सरदार पटेल', 'बी.आर. आंबेडकर'], correct: 0 },
            { q: 'भारताची राजधानी कोणती?', opts: ['नवी दिल्ली', 'मुंबई', 'कोलकाता', 'चेन्नई'], correct: 0 },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // KANNADA (kn)
  // -------------------------------------------------------------------------
  {
    code: 'kn',
    courses: [
      {
        subject: 'maths', name: 'ಭಿನ್ನರಾಶಿಗಳು ಮತ್ತು ದಶಮಾಂಶಗಳು', slug: 'bhinnarashigalu-dashamsha-kn',
        desc: 'NCERT 5ನೇ ತರಗತಿ ಗಣಿತ — ಭಿನ್ನರಾಶಿಗಳು, ದಶಮಾಂಶಗಳು ಕನ್ನಡದಲ್ಲಿ ಕಲಿಯಿರಿ.',
        sections: [
          {
            title: 'ಭಿನ್ನರಾಶಿಗಳ ಪರಿಚಯ',
            lessons: [
              { title: 'ಭಿನ್ನರಾಶಿ ಎಂದರೇನು?', content: 'ಭಿನ್ನರಾಶಿ ಎಂದರೆ ಒಟ್ಟಿನ ಒಂದು ಭಾಗ. ಉದಾಹರಣೆ: 1/2 ಎಂದರೆ ಅರ್ಧ.' },
              { title: 'ಅಂಶ ಮತ್ತು ಛೇದ', content: 'ಮೇಲಿನ ಸಂಖ್ಯೆಯನ್ನು ಅಂಶ ಮತ್ತು ಕೆಳಗಿನ ಸಂಖ್ಯೆಯನ್ನು ಛೇದ ಎನ್ನುತ್ತಾರೆ.' },
            ],
            topics: [
              { title: 'ಭಿನ್ನರಾಶಿಗಳನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳುವುದು', content: 'ಭಿನ್ನರಾಶಿ ಎಂದರೆ ಪೂರ್ಣ ವಸ್ತುವಿನ ಒಂದು ಭಾಗ. ಒಂದು ರೊಟ್ಟಿಯನ್ನು ಎರಡು ಸಮ ಭಾಗ ಮಾಡಿದರೆ ಪ್ರತಿ ಭಾಗ 1/2.' },
              { title: 'ಅಭ್ಯಾಸ: ಭಿನ್ನರಾಶಿಗಳನ್ನು ಗುರುತಿಸಿ', content: 'ಕೆಳಗಿನ ಚಿತ್ರಗಳಲ್ಲಿ ಬಣ್ಣ ಹಚ್ಚಿದ ಭಾಗವನ್ನು ಭಿನ್ನರಾಶಿಯಾಗಿ ಬರೆಯಿರಿ.' },
            ],
          },
          {
            title: 'ದಶಮಾಂಶ ಸಂಖ್ಯೆಗಳು',
            lessons: [
              { title: 'ದಶಮಾಂಶ ಪರಿಚಯ', content: 'ದಶಮಾಂಶ ಬಿಂದುವಿನ ನಂತರದ ಅಂಕಿಗಳು ಹತ್ತನೇ, ನೂರನೇ ಭಾಗಗಳನ್ನು ಸೂಚಿಸುತ್ತವೆ.' },
              { title: 'ದಶಮಾಂಶ ಸಂಕಲನ ಮತ್ತು ವ್ಯವಕಲನ', content: 'ದಶಮಾಂಶ ಬಿಂದುಗಳನ್ನು ಒಂದೇ ಸಾಲಿನಲ್ಲಿ ಇಟ್ಟು ಸಂಕಲನ ಅಥವಾ ವ್ಯವಕಲನ ಮಾಡಿ.' },
            ],
            topics: [
              { title: 'ದಶಮಾಂಶ ಸ್ಥಾನ ಬೆಲೆ', content: 'ದಶಮಾಂಶ ಬಿಂದುವಿನ ಬಲ ಭಾಗದ ಮೊದಲ ಸ್ಥಾನ ಹತ್ತನೇ ಭಾಗ ಮತ್ತು ಎರಡನೇ ಸ್ಥಾನ ನೂರನೇ ಭಾಗ.' },
              { title: 'ಅಭ್ಯಾಸ: ದಶಮಾಂಶ ಪರಿವರ್ತನೆ', content: 'ಭಿನ್ನರಾಶಿ 1/4 ಅನ್ನು ದಶಮಾಂಶಕ್ಕೆ ಪರಿವರ್ತಿಸಿ: 1÷4 = 0.25.' },
            ],
          },
        ],
        quiz: {
          title: 'ಭಿನ್ನರಾಶಿಗಳು ಮತ್ತು ದಶಮಾಂಶಗಳು ರಸಪ್ರಶ್ನೆ',
          questions: [
            { q: 'ಭಿನ್ನರಾಶಿ 3/4 ರಲ್ಲಿ ಛೇದ ಏನು?', opts: ['4', '3', '7', '1'], correct: 0 },
            { q: '0.5 ಅನ್ನು ಭಿನ್ನರಾಶಿಯಾಗಿ ಹೇಗೆ ಬರೆಯುವಿರಿ?', opts: ['1/2', '1/3', '1/4', '1/5'], correct: 0 },
            { q: '1/2 + 1/4 ಎಷ್ಟು?', opts: ['3/4', '2/4', '1/6', '2/6'], correct: 0 },
          ],
        },
      },
      {
        subject: 'science', name: 'ಸಸ್ಯಗಳು ಮತ್ತು ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ', slug: 'sasyagalu-dyutisanshle-kn',
        desc: 'NCERT 5ನೇ ತರಗತಿ ವಿಜ್ಞಾನ — ಸಸ್ಯಗಳು ಆಹಾರ ಹೇಗೆ ತಯಾರಿಸುತ್ತವೆ ಕನ್ನಡದಲ್ಲಿ ಅರ್ಥಮಾಡಿಕೊಳ್ಳಿ.',
        sections: [
          {
            title: 'ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ ಮೂಲ ಅಂಶಗಳು',
            lessons: [
              { title: 'ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ ಎಂದರೇನು?', content: 'ಸಸ್ಯಗಳು ಸೂರ್ಯನ ಬೆಳಕು, ನೀರು ಮತ್ತು ಇಂಗಾಲದ ಡೈಆಕ್ಸೈಡ್‌ನಿಂದ ತಮ್ಮ ಆಹಾರವನ್ನು ತಯಾರಿಸುತ್ತವೆ.' },
              { title: 'ಎಲೆಗಳ ಪಾತ್ರ', content: 'ಎಲೆಗಳಲ್ಲಿ ಹಸಿರು ವರ್ಣದ್ರವ್ಯ (ಕ್ಲೋರೊಫಿಲ್) ಇರುತ್ತದೆ, ಇದು ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆಯಲ್ಲಿ ಸಹಾಯ ಮಾಡುತ್ತದೆ.' },
            ],
            topics: [
              { title: 'ಕ್ಲೋರೊಫಿಲ್ ಮತ್ತು ಹಸಿರು ಬಣ್ಣ', content: 'ಕ್ಲೋರೊಫಿಲ್ ಒಂದು ಹಸಿರು ವರ್ಣದ್ರವ್ಯ, ಇದು ಸೂರ್ಯನ ಬೆಳಕನ್ನು ಹೀರಿಕೊಳ್ಳುತ್ತದೆ.' },
              { title: 'ಪ್ರಯೋಗ: ಎಲೆಯಲ್ಲಿ ಪಿಷ್ಟ', content: 'ಅಯೋಡಿನ್ ಪರೀಕ್ಷೆಯ ಮೂಲಕ ಎಲೆಯಲ್ಲಿ ಪಿಷ್ಟ ಇದೆಯೇ ಎಂದು ಪರಿಶೀಲಿಸಿ.' },
            ],
          },
          {
            title: 'ಸಸ್ಯ ಜೀವನ ಚಕ್ರ',
            lessons: [
              { title: 'ಬೀಜದಿಂದ ಸಸ್ಯ', content: 'ಬೀಜ ಮೊಳಕೆಯೊಡೆದು ಬೇರು, ಕಾಂಡ ಮತ್ತು ಎಲೆಗಳು ರೂಪುಗೊಳ್ಳುತ್ತವೆ.' },
              { title: 'ಪರಾಗಸ್ಪರ್ಶ ಮತ್ತು ಹಣ್ಣುಗಳು', content: 'ಹೂವುಗಳಲ್ಲಿ ಪರಾಗಸ್ಪರ್ಶದ ನಂತರ ಹಣ್ಣು ಮತ್ತು ಬೀಜಗಳು ರೂಪುಗೊಳ್ಳುತ್ತವೆ.' },
            ],
            topics: [
              { title: 'ಮೊಳಕೆಯೊಡೆಯುವ ಪ್ರಕ್ರಿಯೆ', content: 'ಬೀಜಕ್ಕೆ ತೇವ, ಬಿಸಿ ಮತ್ತು ಗಾಳಿ ಸಿಕ್ಕಾಗ ಮೊಳಕೆಯೊಡೆಯುವಿಕೆ ನಡೆಯುತ್ತದೆ.' },
              { title: 'ಚಟುವಟಿಕೆ: ಬೀಜ ಬೆಳೆಸುವುದು', content: 'ತೇವವಾದ ಹತ್ತಿಯ ಮೇಲೆ ಹೆಸರು ಕಾಳು ಇಟ್ಟು 5 ದಿನ ವೀಕ್ಷಿಸಿ.' },
            ],
          },
        ],
        quiz: {
          title: 'ಸಸ್ಯಗಳು ಮತ್ತು ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ ರಸಪ್ರಶ್ನೆ',
          questions: [
            { q: 'ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆಯಲ್ಲಿ ಸಸ್ಯಗಳು ಯಾವ ಅನಿಲವನ್ನು ಹೀರಿಕೊಳ್ಳುತ್ತವೆ?', opts: ['ಇಂಗಾಲದ ಡೈಆಕ್ಸೈಡ್', 'ಆಮ್ಲಜನಕ', 'ಸಾರಜನಕ', 'ಜಲಜನಕ'], correct: 0 },
            { q: 'ಸಸ್ಯದ ಯಾವ ಭಾಗ ಆಹಾರ ತಯಾರಿಸುತ್ತದೆ?', opts: ['ಎಲೆ', 'ಬೇರು', 'ಕಾಂಡ', 'ಹೂವು'], correct: 0 },
            { q: 'ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆಗೆ ಏನು ಬೇಕು?', opts: ['ಸೂರ್ಯನ ಬೆಳಕು ಮತ್ತು ನೀರು', 'ಮಣ್ಣು ಮತ್ತು ಗಾಳಿ', 'ಮಳೆ ಮತ್ತು ಬೆಂಕಿ', 'ಹಿಮ ಮತ್ತು ಚಳಿ'], correct: 0 },
          ],
        },
      },
      {
        subject: 'language', name: 'ಕನ್ನಡ ಓದು ಮತ್ತು ಬರಹ', slug: 'kannada-odu-baraha-kn',
        desc: 'NCERT 5ನೇ ತರಗತಿ ಕನ್ನಡ — ಓದುವಿಕೆ, ಬರೆಯುವಿಕೆ ಮತ್ತು ವ್ಯಾಕರಣ ಅಭ್ಯಾಸ.',
        sections: [
          {
            title: 'ಓದುವ ಕೌಶಲ್ಯಗಳು',
            lessons: [
              { title: 'ಕಥೆ ಓದುವುದು', content: 'ಕಥೆ ಓದಿ ಪ್ರಮುಖ ಪಾತ್ರ, ಘಟನೆ ಮತ್ತು ಸಂದೇಶವನ್ನು ಗುರುತಿಸಲು ಕಲಿಯಿರಿ.' },
              { title: 'ಪದ ಸಂಪತ್ತು ಹೆಚ್ಚಿಸುವುದು', content: 'ಹೊಸ ಪದಗಳ ಅರ್ಥ ತಿಳಿದು ವಾಕ್ಯಗಳಲ್ಲಿ ಬಳಸಿ.' },
            ],
            topics: [
              { title: 'ಮುಖ್ಯ ವಿಚಾರ ಹುಡುಕುವುದು', content: 'ಒಂದು ಪ್ಯಾರಾದ ಮುಖ್ಯ ವಿಚಾರ ಎಂದರೆ ಇಡೀ ಪ್ಯಾರಾ ಹೇಳಲು ಬಯಸುವ ವಿಷಯ.' },
              { title: 'ಅಭ್ಯಾಸ: ಪ್ರಶ್ನೆ-ಉತ್ತರ', content: 'ನೀಡಿದ ಕಥೆ ಓದಿ ಕೆಳಗಿನ ಪ್ರಶ್ನೆಗಳಿಗೆ ಉತ್ತರ ಬರೆಯಿರಿ.' },
            ],
          },
          {
            title: 'ಬರೆಯುವಿಕೆ ಮತ್ತು ವ್ಯಾಕರಣ',
            lessons: [
              { title: 'ನಾಮಪದ ಮತ್ತು ಸರ್ವನಾಮ', content: 'ನಾಮಪದ ಯಾವುದೇ ವ್ಯಕ್ತಿ, ವಸ್ತು ಅಥವಾ ಸ್ಥಳದ ಹೆಸರು; ಸರ್ವನಾಮ ನಾಮಪದದ ಬದಲಿಗೆ ಬರುತ್ತದೆ.' },
              { title: 'ಪತ್ರ ಬರೆಯುವುದು', content: 'ಔಪಚಾರಿಕ ಪತ್ರದಲ್ಲಿ ಕಳುಹಿಸುವವರ ವಿಳಾಸ, ದಿನಾಂಕ, ವಿಷಯ ಮತ್ತು ನಮಸ್ಕಾರ ಇರುತ್ತದೆ.' },
            ],
            topics: [
              { title: 'ಕ್ರಿಯಾಪದ ಮತ್ತು ಗುಣವಾಚಕ', content: 'ಕ್ರಿಯಾಪದ ಕೆಲಸವನ್ನು ತಿಳಿಸುತ್ತದೆ, ಗುಣವಾಚಕ ನಾಮಪದದ ಗುಣಲಕ್ಷಣ ವಿವರಿಸುತ್ತದೆ.' },
              { title: 'ಅಭ್ಯಾಸ: ಪ್ರಬಂಧ ಬರೆಯಿರಿ', content: '"ನನ್ನ ಇಷ್ಟದ ಹಬ್ಬ" ಎಂಬ ವಿಷಯದ ಬಗ್ಗೆ 10 ವಾಕ್ಯಗಳ ಪ್ರಬಂಧ ಬರೆಯಿರಿ.' },
            ],
          },
        ],
        quiz: {
          title: 'ಕನ್ನಡ ಓದು ಮತ್ತು ಬರಹ ರಸಪ್ರಶ್ನೆ',
          questions: [
            { q: 'ನಾಮಪದ ಎಂದರೇನು?', opts: ['ವ್ಯಕ್ತಿ, ವಸ್ತು ಅಥವಾ ಸ್ಥಳದ ಹೆಸರು', 'ಕ್ರಿಯೆಯ ಇನ್ನೊಂದು ಹೆಸರು', 'ಗುಣವಾಚಕದ ಪ್ರಕಾರ', 'ಸರ್ವನಾಮದ ಪರ್ಯಾಯ'], correct: 0 },
            { q: 'ವಿರಾಮ ಚಿಹ್ನೆಗಳ ಉಪಯೋಗ ಏನು?', opts: ['ವಾಕ್ಯವನ್ನು ಸ್ಪಷ್ಟಗೊಳಿಸುವುದು', 'ವಾಕ್ಯವನ್ನು ಉದ್ದ ಮಾಡುವುದು', 'ಬಣ್ಣ ಸೇರಿಸುವುದು', 'ಪದಗಳನ್ನು ತೆಗೆಯುವುದು'], correct: 0 },
            { q: 'ಸಮಾನಾರ್ಥಕ ಪದ ಎಂದರೇನು?', opts: ['ಒಂದೇ ಅರ್ಥದ ಪದ', 'ವಿರುದ್ಧ ಅರ್ಥದ ಪದ', 'ಕ್ರಿಯಾಪದದ ಪ್ರಕಾರ', 'ಒಂದು ಸರ್ವನಾಮ'], correct: 0 },
          ],
        },
      },
      {
        subject: 'social', name: 'ಭಾರತದ ಇತಿಹಾಸ', slug: 'bharatada-itihasa-kn',
        desc: 'NCERT 5ನೇ ತರಗತಿ ಸಮಾಜ ವಿಜ್ಞಾನ — ಪ್ರಾಚೀನ ನಾಗರಿಕತೆಗಳಿಂದ ಸ್ವಾತಂತ್ರ್ಯ ಚಳವಳಿವರೆಗೆ.',
        sections: [
          {
            title: 'ಪ್ರಾಚೀನ ಭಾರತ',
            lessons: [
              { title: 'ಸಿಂಧೂ ಕಣಿವೆ ನಾಗರಿಕತೆ', content: 'ಸಿಂಧೂ ಕಣಿವೆ ನಾಗರಿಕತೆ ಸುಮಾರು 5000 ವರ್ಷಗಳ ಹಿಂದಿನದು, ಮೊಹೆಂಜೊದಾರೋ ಅದರ ಪ್ರಮುಖ ನಗರ.' },
              { title: 'ವೈದಿಕ ಕಾಲ', content: 'ವೈದಿಕ ಕಾಲದಲ್ಲಿ ವೇದಗಳ ರಚನೆ ಆಯಿತು ಮತ್ತು ಕೃಷಿ ಪ್ರಮುಖ ಉದ್ಯೋಗವಾಗಿತ್ತು.' },
            ],
            topics: [
              { title: 'ಮೊಹೆಂಜೊದಾರೋ ಶೋಧನೆ', content: 'ಮೊಹೆಂಜೊದಾರೋದಲ್ಲಿ ನಗರ ಯೋಜನೆ, ಸ್ನಾನಗೃಹ ಮತ್ತು ಒಳಚರಂಡಿ ವ್ಯವಸ್ಥೆ ಕಂಡುಬಂದಿತು.' },
              { title: 'ನಕ್ಷೆ ಚಟುವಟಿಕೆ', content: 'ಭಾರತದ ನಕ್ಷೆಯ ಮೇಲೆ ಸಿಂಧೂ ಕಣಿವೆಯ ಪ್ರಮುಖ ಸ್ಥಳಗಳನ್ನು ಗುರುತಿಸಿ.' },
            ],
          },
          {
            title: 'ಸ್ವಾತಂತ್ರ್ಯ ಚಳವಳಿ',
            lessons: [
              { title: 'ಮಹಾತ್ಮ ಗಾಂಧಿ ಮತ್ತು ಅಹಿಂಸೆ', content: 'ಗಾಂಧೀಜಿ ಸತ್ಯ ಮತ್ತು ಅಹಿಂಸೆಯ ಮಾರ್ಗದಲ್ಲಿ ಭಾರತಕ್ಕೆ ಸ್ವಾತಂತ್ರ್ಯ ತಂದುಕೊಟ್ಟರು.' },
              { title: '1947: ಸ್ವಾತಂತ್ರ್ಯ ದಿನ', content: '1947 ಆಗಸ್ಟ್ 15 ರಂದು ಭಾರತ ಬ್ರಿಟಿಷ್ ಆಡಳಿತದಿಂದ ಸ್ವತಂತ್ರವಾಯಿತು.' },
            ],
            topics: [
              { title: 'ಉಪ್ಪಿನ ಸತ್ಯಾಗ್ರಹ', content: '1930 ರಲ್ಲಿ ಗಾಂಧೀಜಿ ದಂಡಿ ಯಾತ್ರೆ ಮಾಡಿ ಉಪ್ಪಿನ ಕಾನೂನು ಮುರಿದರು.' },
              { title: 'ಕಾಲರೇಖೆ: ಸ್ವಾತಂತ್ರ್ಯದ ಹಂತಗಳು', content: '1857 ದಂಗೆ, ಅಸಹಕಾರ ಚಳವಳಿ, ಭಾರತ ಬಿಟ್ಟು ತೊಲಗಿ — ಪ್ರಮುಖ ಘಟನೆಗಳನ್ನು ಕ್ರಮದಲ್ಲಿ ಜೋಡಿಸಿ.' },
            ],
          },
        ],
        quiz: {
          title: 'ಭಾರತದ ಇತಿಹಾಸ ರಸಪ್ರಶ್ನೆ',
          questions: [
            { q: 'ಭಾರತದ ಅತ್ಯಂತ ಉದ್ದವಾದ ನದಿ ಯಾವುದು?', opts: ['ಗಂಗಾ', 'ಯಮುನಾ', 'ಗೋದಾವರಿ', 'ನರ್ಮದಾ'], correct: 0 },
            { q: 'ಭಾರತದ ಮೊದಲ ಪ್ರಧಾನ ಮಂತ್ರಿ ಯಾರು?', opts: ['ಜವಾಹರಲಾಲ್ ನೆಹರು', 'ಮಹಾತ್ಮ ಗಾಂಧಿ', 'ಸರ್ದಾರ್ ಪಟೇಲ್', 'ಬಿ.ಆರ್. ಅಂಬೇಡ್ಕರ್'], correct: 0 },
            { q: 'ಭಾರತದ ರಾಜಧಾನಿ ಯಾವುದು?', opts: ['ಹೊಸ ದಿಲ್ಲಿ', 'ಮುಂಬೈ', 'ಕೋಲ್ಕತಾ', 'ಚೆನ್ನೈ'], correct: 0 },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // BENGALI (bn)
  // -------------------------------------------------------------------------
  {
    code: 'bn',
    courses: [
      {
        subject: 'maths', name: 'ভগ্নাংশ ও দশমিক', slug: 'bhognansho-o-doshomik-bn',
        desc: 'NCERT পঞ্চম শ্রেণি গণিত — ভগ্নাংশ, দশমিক এবং সংখ্যা জ্ঞান বাংলায় শিখুন।',
        sections: [
          {
            title: 'ভগ্নাংশের পরিচয়',
            lessons: [
              { title: 'ভগ্নাংশ কী?', content: 'ভগ্নাংশ হলো সম্পূর্ণের একটি অংশ। উদাহরণ: 1/2 মানে অর্ধেক।' },
              { title: 'লব ও হর', content: 'উপরের সংখ্যাকে লব এবং নীচের সংখ্যাকে হর বলে।' },
            ],
            topics: [
              { title: 'ভগ্নাংশ বোঝা', content: 'ভগ্নাংশ মানে পুরোটার একটি অংশ। একটি রুটি দুই সমান ভাগ করলে প্রতিটি ভাগ 1/2।' },
              { title: 'অনুশীলন: ভগ্নাংশ চিনুন', content: 'নীচের চিত্রগুলিতে রঙিন অংশটিকে ভগ্নাংশ আকারে লিখুন।' },
            ],
          },
          {
            title: 'দশমিক সংখ্যা',
            lessons: [
              { title: 'দশমিকের পরিচয়', content: 'দশমিক বিন্দুর পরের অঙ্কগুলি দশমাংশ, শতাংশ নির্দেশ করে।' },
              { title: 'দশমিক যোগ ও বিয়োগ', content: 'দশমিক বিন্দু একই সারিতে রেখে যোগ বা বিয়োগ করুন।' },
            ],
            topics: [
              { title: 'দশমিক স্থানীয় মান', content: 'দশমিক বিন্দুর ডানদিকের প্রথম স্থান দশমাংশ এবং দ্বিতীয় স্থান শতাংশ।' },
              { title: 'অনুশীলন: দশমিক রূপান্তর', content: 'ভগ্নাংশ 1/4 কে দশমিকে রূপান্তর করুন: 1÷4 = 0.25।' },
            ],
          },
        ],
        quiz: {
          title: 'ভগ্নাংশ ও দশমিক কুইজ',
          questions: [
            { q: 'ভগ্নাংশ 3/4 এ হর কত?', opts: ['4', '3', '7', '1'], correct: 0 },
            { q: '0.5 কে ভগ্নাংশে কীভাবে লিখবেন?', opts: ['1/2', '1/3', '1/4', '1/5'], correct: 0 },
            { q: '1/2 + 1/4 কত?', opts: ['3/4', '2/4', '1/6', '2/6'], correct: 0 },
          ],
        },
      },
      {
        subject: 'science', name: 'উদ্ভিদ ও সালোকসংশ্লেষণ', slug: 'udbhid-o-saloksongsleshon-bn',
        desc: 'NCERT পঞ্চম শ্রেণি বিজ্ঞান — উদ্ভিদ কীভাবে খাদ্য তৈরি করে বাংলায় বুঝুন।',
        sections: [
          {
            title: 'সালোকসংশ্লেষণের মূল বিষয়',
            lessons: [
              { title: 'সালোকসংশ্লেষণ কী?', content: 'উদ্ভিদ সূর্যালোক, জল এবং কার্বন ডাইঅক্সাইড থেকে নিজের খাদ্য তৈরি করে।' },
              { title: 'পাতার ভূমিকা', content: 'পাতায় সবুজ রঞ্জক পদার্থ (ক্লোরোফিল) থাকে যা সালোকসংশ্লেষণে সাহায্য করে।' },
            ],
            topics: [
              { title: 'ক্লোরোফিল ও সবুজ রং', content: 'ক্লোরোফিল একটি সবুজ রঞ্জক পদার্থ যা সূর্যালোক শোষণ করে।' },
              { title: 'পরীক্ষা: পাতায় শ্বেতসার', content: 'আয়োডিন পরীক্ষার মাধ্যমে পাতায় শ্বেতসার আছে কি না তা যাচাই করুন।' },
            ],
          },
          {
            title: 'উদ্ভিদের জীবনচক্র',
            lessons: [
              { title: 'বীজ থেকে উদ্ভিদ', content: 'বীজ অঙ্কুরিত হয়ে মূল, কাণ্ড এবং পাতা তৈরি করে।' },
              { title: 'পরাগায়ন ও ফল', content: 'ফুলে পরাগায়নের পর ফল ও বীজ তৈরি হয়।' },
            ],
            topics: [
              { title: 'অঙ্কুরোদ্গম প্রক্রিয়া', content: 'বীজ আর্দ্রতা, উষ্ণতা ও বায়ু পেলে অঙ্কুরোদ্গম ঘটে।' },
              { title: 'কার্যকলাপ: বীজ বপন', content: 'ভেজা তুলোর ওপর মুগ ডাল রেখে 5 দিন পর্যবেক্ষণ করুন।' },
            ],
          },
        ],
        quiz: {
          title: 'উদ্ভিদ ও সালোকসংশ্লেষণ কুইজ',
          questions: [
            { q: 'সালোকসংশ্লেষণে উদ্ভিদ কোন গ্যাস শোষণ করে?', opts: ['কার্বন ডাইঅক্সাইড', 'অক্সিজেন', 'নাইট্রোজেন', 'হাইড্রোজেন'], correct: 0 },
            { q: 'উদ্ভিদের কোন অংশ খাদ্য তৈরি করে?', opts: ['পাতা', 'মূল', 'কাণ্ড', 'ফুল'], correct: 0 },
            { q: 'সালোকসংশ্লেষণের জন্য কী প্রয়োজন?', opts: ['সূর্যালোক ও জল', 'মাটি ও বাতাস', 'বৃষ্টি ও আগুন', 'বরফ ও ঠান্ডা'], correct: 0 },
          ],
        },
      },
      {
        subject: 'language', name: 'বাংলা পড়া ও লেখা', slug: 'bangla-pora-o-lekha-bn',
        desc: 'NCERT পঞ্চম শ্রেণি বাংলা — পড়া, লেখা এবং ব্যাকরণ অনুশীলন।',
        sections: [
          {
            title: 'পঠন দক্ষতা',
            lessons: [
              { title: 'গল্প পড়া', content: 'গল্প পড়ে প্রধান চরিত্র, ঘটনা ও বার্তা চিনতে শিখুন।' },
              { title: 'শব্দভাণ্ডার বাড়ানো', content: 'নতুন শব্দের অর্থ জানুন এবং বাক্যে ব্যবহার করুন।' },
            ],
            topics: [
              { title: 'মূল ভাবনা খোঁজা', content: 'কোনো অনুচ্ছেদের মূল ভাবনা হলো সম্পূর্ণ অনুচ্ছেদ যা বলতে চায়।' },
              { title: 'অনুশীলন: প্রশ্ন-উত্তর', content: 'প্রদত্ত গল্পটি পড়ে নীচের প্রশ্নগুলির উত্তর লিখুন।' },
            ],
          },
          {
            title: 'লেখন ও ব্যাকরণ',
            lessons: [
              { title: 'বিশেষ্য ও সর্বনাম', content: 'বিশেষ্য হলো কোনো ব্যক্তি, বস্তু বা স্থানের নাম; সর্বনাম বিশেষ্যের পরিবর্তে আসে।' },
              { title: 'চিঠি লেখা', content: 'আনুষ্ঠানিক চিঠিতে প্রেরকের ঠিকানা, তারিখ, বিষয় এবং সম্ভাষণ থাকে।' },
            ],
            topics: [
              { title: 'ক্রিয়া ও বিশেষণ', content: 'ক্রিয়া কাজ বোঝায় এবং বিশেষণ বিশেষ্যের গুণ বর্ণনা করে।' },
              { title: 'অনুশীলন: রচনা লিখুন', content: '"আমার প্রিয় উৎসব" বিষয়ে 10টি বাক্যের রচনা লিখুন।' },
            ],
          },
        ],
        quiz: {
          title: 'বাংলা পড়া ও লেখা কুইজ',
          questions: [
            { q: 'বিশেষ্য কী?', opts: ['ব্যক্তি, বস্তু বা স্থানের নাম', 'ক্রিয়ার অন্য নাম', 'বিশেষণের প্রকার', 'সর্বনামের প্রতিশব্দ'], correct: 0 },
            { q: 'যতিচিহ্নের ব্যবহার কী?', opts: ['বাক্য স্পষ্ট করা', 'বাক্য দীর্ঘ করা', 'রং যোগ করা', 'শব্দ বাদ দেওয়া'], correct: 0 },
            { q: 'সমার্থক শব্দ কী?', opts: ['একই অর্থের শব্দ', 'বিপরীত অর্থের শব্দ', 'ক্রিয়ার প্রকার', 'একটি সর্বনাম'], correct: 0 },
          ],
        },
      },
      {
        subject: 'social', name: 'ভারতের ইতিহাস', slug: 'bharoter-itihas-bn',
        desc: 'NCERT পঞ্চম শ্রেণি সমাজবিদ্যা — প্রাচীন সভ্যতা থেকে স্বাধীনতা আন্দোলন পর্যন্ত।',
        sections: [
          {
            title: 'প্রাচীন ভারত',
            lessons: [
              { title: 'সিন্ধু উপত্যকা সভ্যতা', content: 'সিন্ধু উপত্যকা সভ্যতা প্রায় 5000 বছর পুরোনো, মহেঞ্জোদাড়ো ছিল এর প্রধান নগর।' },
              { title: 'বৈদিক যুগ', content: 'বৈদিক যুগে বেদ রচিত হয়েছিল এবং কৃষি ছিল প্রধান পেশা।' },
            ],
            topics: [
              { title: 'মহেঞ্জোদাড়ো আবিষ্কার', content: 'মহেঞ্জোদাড়োতে নগর পরিকল্পনা, স্নানাগার ও পয়ঃনিষ্কাশন ব্যবস্থা পাওয়া গেছে।' },
              { title: 'মানচিত্র কার্যকলাপ', content: 'ভারতের মানচিত্রে সিন্ধু উপত্যকার প্রধান স্থানগুলি চিহ্নিত করুন।' },
            ],
          },
          {
            title: 'স্বাধীনতা আন্দোলন',
            lessons: [
              { title: 'মহাত্মা গান্ধী ও অহিংসা', content: 'গান্ধীজি সত্য ও অহিংসার পথে ভারতকে স্বাধীনতা এনে দিয়েছিলেন।' },
              { title: '1947: স্বাধীনতা দিবস', content: '1947 সালের 15 আগস্ট ভারত ব্রিটিশ শাসন থেকে স্বাধীন হয়।' },
            ],
            topics: [
              { title: 'লবণ সত্যাগ্রহ', content: '1930 সালে গান্ধীজি ডান্ডি যাত্রা করে লবণ আইন ভঙ্গ করেন।' },
              { title: 'সময়রেখা: স্বাধীনতার ধাপ', content: '1857 বিদ্রোহ, অসহযোগ আন্দোলন, ভারত ছাড়ো আন্দোলন — প্রধান ঘটনাগুলি ক্রমানুসারে সাজান।' },
            ],
          },
        ],
        quiz: {
          title: 'ভারতের ইতিহাস কুইজ',
          questions: [
            { q: 'ভারতের দীর্ঘতম নদী কোনটি?', opts: ['গঙ্গা', 'যমুনা', 'গোদাবরী', 'নর্মদা'], correct: 0 },
            { q: 'ভারতের প্রথম প্রধানমন্ত্রী কে ছিলেন?', opts: ['জওহরলাল নেহরু', 'মহাত্মা গান্ধী', 'সর্দার প্যাটেল', 'বি.আর. আম্বেদকর'], correct: 0 },
            { q: 'ভারতের রাজধানী কী?', opts: ['নতুন দিল্লি', 'মুম্বাই', 'কলকাতা', 'চেন্নাই'], correct: 0 },
          ],
        },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  let courseCount = 0;
  let sectionCount = 0;
  let lessonCount = 0;
  let topicCount = 0;
  let quizCount = 0;
  let questionCount = 0;
  let optionCount = 0;

  try {
    await client.query('BEGIN');

    for (const lang of LANGUAGES) {
      let sortOrder = 0;

      for (const course of lang.courses) {
        sortOrder++;
        const productId = randomUUID();
        const instructorId = INSTRUCTORS[course.subject];

        // Insert product
        await client.query(
          `INSERT INTO products (id, product_name, product_slug, product_description,
            amount_cents, currency, content_type, is_published, published_at, sort_order,
            instructor_id, created_by_staff_id, language, created_at, updated_at)
           VALUES ($1,$2,$3,$4, 0,'inr','course',true,NOW(),$5, $6,$7,$8, NOW(),NOW())`,
          [productId, course.name, course.slug, course.desc, sortOrder, instructorId, ADMIN_STAFF_ID, lang.code],
        );
        courseCount++;

        // Insert sections, lessons and topics
        for (let si = 0; si < course.sections.length; si++) {
          const sec = course.sections[si];
          const sectionId = randomUUID();

          await client.query(
            `INSERT INTO sections (id, product_id, title, sort_order, is_published, created_at, updated_at)
             VALUES ($1,$2,$3,$4,true,NOW(),NOW())`,
            [sectionId, productId, sec.title, si + 1],
          );
          sectionCount++;

          // Insert 2 lessons per section
          const lessonIds = [];
          for (let li = 0; li < sec.lessons.length; li++) {
            const lessonId = randomUUID();
            lessonIds.push(lessonId);

            await client.query(
              `INSERT INTO lessons (id, product_id, section_id, title, content, lesson_type, section_name, sort_order, is_published, created_at, updated_at)
               VALUES ($1,$2,$3,$4,$5,'text',$6,$7,true,NOW(),NOW())`,
              [lessonId, productId, sectionId, sec.lessons[li].title, sec.lessons[li].content, sec.title, li + 1],
            );
            lessonCount++;
          }

          // Insert 2 topics per section (attached to first lesson of the section)
          for (let ti = 0; ti < sec.topics.length; ti++) {
            const topicId = randomUUID();

            await client.query(
              `INSERT INTO topics (id, lesson_id, product_id, section_id, title, content, topic_type, sort_order, is_published, created_at, updated_at)
               VALUES ($1,$2,$3,$4,$5,$6,'text',$7,true,NOW(),NOW())`,
              [topicId, lessonIds[ti] || lessonIds[0], productId, sectionId, sec.topics[ti].title, sec.topics[ti].content, ti + 1],
            );
            topicCount++;
          }
        }

        // Insert 1 quiz
        const quizId = randomUUID();
        await client.query(
          `INSERT INTO quizzes (id, product_id, title, passing_percentage, sort_order, is_published, created_at, updated_at)
           VALUES ($1,$2,$3,80,1,true,NOW(),NOW())`,
          [quizId, productId, course.quiz.title],
        );
        quizCount++;

        // Insert quiz questions + 4 options each
        const questions = course.quiz.questions;
        for (let qi = 0; qi < questions.length; qi++) {
          const questionId = randomUUID();

          await client.query(
            `INSERT INTO quiz_questions (id, quiz_id, question_text, question_type, points, sort_order, created_at, updated_at)
             VALUES ($1,$2,$3,'single',1,$4,NOW(),NOW())`,
            [questionId, quizId, questions[qi].q, qi + 1],
          );
          questionCount++;

          for (let oi = 0; oi < questions[qi].opts.length; oi++) {
            const optionId = randomUUID();

            await client.query(
              `INSERT INTO quiz_question_options (id, question_id, option_text, is_correct, sort_order, created_at)
               VALUES ($1,$2,$3,$4,$5,NOW())`,
              [optionId, questionId, questions[qi].opts[oi], oi === questions[qi].correct, oi + 1],
            );
            optionCount++;
          }
        }
      }
    }

    await client.query('COMMIT');

    console.log('Seed complete:');
    console.log(`  Courses:   ${courseCount}`);
    console.log(`  Sections:  ${sectionCount}`);
    console.log(`  Lessons:   ${lessonCount}`);
    console.log(`  Topics:    ${topicCount}`);
    console.log(`  Quizzes:   ${quizCount}`);
    console.log(`  Questions: ${questionCount}`);
    console.log(`  Options:   ${optionCount}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
