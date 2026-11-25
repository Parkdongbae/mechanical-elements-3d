// 「507 기계 운동」 소개 — 영어·일본어·중국어·힌디어·아랍어 본문(한국어는 about.ts 의 buildAbout).
// 한글 본문과 같은 사실만 쓴다(작업 지시서 16 §5). 서문 번역 인용은 한글 전용이라 뺀다.

export interface AboutText {
  eyebrow: string;
  title: string;
  book: { h: string; p: string[] };
  layout: { h: string; p: string[] };
  preface: { h: string; li: string[] };
  why: { h: string; p: string[] };
  how: { h: string; li: (done3d: number) => string[] };
  more: { h: string; ext: string };
  toList: string;
}

export const ABOUT: Record<'en' | 'ja' | 'zh' | 'hi' | 'ar', AboutText> = {
  en: {
    eyebrow: 'About',
    title: 'A picture dictionary of machines, 150 years ago',
    book: {
      h: 'The book',
      p: [
        '“Five Hundred and Seven Mechanical Movements” was first published in 1868. The material shown here is a scan of the 1871 printing (Cornell University Library copy).',
        'It was compiled by Henry T. Brown, described on the title page as editor of the magazine “American Artisan”, and published by Brown, Coombs & Co. of New York.',
        'The subtitle sets out its scope: movements important in dynamics, hydraulics, hydrostatics, pneumatics, steam engines, mill and other gearing, presses, horology and miscellaneous machinery, including many never published before and several only recently introduced.'
      ]
    },
    layout: {
      h: 'How the book is laid out',
      p: [
        'Each left-hand page holds nine or ten engravings, and the facing right-hand page holds the descriptions with the same numbers. The author noted in the preface that this facing arrangement makes reference easy.',
        'The movements end with No. 507 on page 122, followed by advertisements of the period.'
      ]
    },
    preface: {
      h: 'What the author says in the preface',
      li: [
        'It was compiled because a collection of mechanical movements had long been needed.',
        'The contents first appeared in the magazine “American Artisan”, across five volumes.',
        'More than a quarter of the movements were new, and it held about three times as many as any earlier American book.',
        'The classification is not complete, but a detailed index and facing pictures and text make it easy to search.'
      ]
    },
    why: {
      h: 'Why it matters',
      p: [
        'Before computers and video, inventors and engineers used this book as a picture dictionary to find which mechanism would produce the motion they needed.',
        'The same principles are still inside machines 150 years later — a bicycle chain, a clock escapement and an engine crank are examples.',
        'The book is in the public domain, so anyone can read it and build from it.'
      ]
    },
    how: {
      h: 'How to use this site',
      li: (d) => [
        'Pick an engraving in the list to browse the 507 movements.',
        `Movements with a finished 3D model (${d} / 507 so far) actually move. They are being built in book order from No. 1.`,
        'If an engraving is hard to follow, read the “Easy explanation” tab first.'
      ]
    },
    more: { h: 'More', ext: 'Also worth a visit — 507movements.com (animated engravings; that content belongs to that site)' },
    toList: 'Go to the movements list'
  },
  ja: {
    eyebrow: '紹介',
    title: '150年前の、機械をさがすための図鑑',
    book: {
      h: 'この本について',
      p: [
        '『Five Hundred and Seven Mechanical Movements（507の機械運動）』は1868年に初めて出版されました。ここで使っている資料は1871年の刷り（コーネル大学図書館所蔵本）をスキャンしたものです。',
        '編者はヘンリー・T・ブラウンで、扉には雑誌『American Artisan』の編集者と書かれています。出版はニューヨークの Brown, Coombs & Co. です。',
        '副題には扱う範囲が書かれています。動力学、水力学、静水力学、空気力学、蒸気機関、製粉機などの歯車装置、プレス、時計、その他の機械で大切な運動を集め、これまで発表されたことのないものや、最近になって登場したものも多く含みます。'
      ]
    },
    layout: {
      h: '本のつくり',
      p: [
        '左のページに版画が9〜10点あり、向かいの右のページに同じ番号の説明が載っています。著者は序文で、この見開きの並べ方で調べやすくなると書いています。',
        '運動は122ページの507番で終わり、そのあとに当時の広告が続きます。'
      ]
    },
    preface: {
      h: '著者が序文で言っていること',
      li: [
        '機械運動を集めた本が長いあいだ求められていたので、まとめた。',
        '内容は雑誌『American Artisan』に5巻にわたって最初に載ったもの。',
        '運動の4分の1以上が新しいもので、それまでのアメリカの本の約3倍の数を収めている。',
        '分類は完全ではないが、くわしい索引と、図と説明の見開きで探しやすくしてある。'
      ]
    },
    why: {
      h: 'なぜ大切なのか',
      p: [
        'コンピューターや動画がなかった時代、発明家や技術者はこの本を図鑑のように使い、ほしい動きをつくる仕組みをさがしました。',
        '同じ原理は150年たった今も機械の中で働いています。自転車のチェーン、時計の脱進機、エンジンのクランクがその例です。',
        'この本はパブリックドメインなので、だれでも読み、もとにしてものをつくることができます。'
      ]
    },
    how: {
      h: 'このサイトの使い方',
      li: (d) => [
        '一覧から版画を選ぶと、507の運動を見ることができます。',
        `3Dモデルができた運動（いまは ${d} / 507）は実際に動きます。本の順に1番からつくっています。`,
        '版画がわかりにくいときは、まず「やさしい説明」タブを読んでください。'
      ]
    },
    more: { h: 'もっと見る', ext: 'あわせて見たいサイト — 507movements.com（動く版画。内容の著作権はそのサイトにあります）' },
    toList: '運動の一覧へ'
  },
  zh: {
    eyebrow: '简介',
    title: '150年前的机械图典',
    book: {
      h: '关于这本书',
      p: [
        '《Five Hundred and Seven Mechanical Movements（507种机械运动）》于1868年首次出版。这里使用的资料是1871年印本（康奈尔大学图书馆藏本）的扫描件。',
        '编者是亨利·T·布朗，扉页上写着他是《American Artisan》杂志的编辑。出版者是纽约的 Brown, Coombs & Co.。',
        '副标题说明了本书的范围：收录动力学、水力学、静水力学、气动学、蒸汽机、磨坊及其他齿轮装置、压力机、钟表和各种机械中的重要运动，其中许多从未发表过，也有一些是新近才出现的。'
      ]
    },
    layout: {
      h: '书的编排',
      p: [
        '每个左页有九到十幅版画，对面的右页是相同编号的说明。作者在序言中说，这种对页排列便于查阅。',
        '运动在第122页的第507号结束，后面是当时的广告。'
      ]
    },
    preface: {
      h: '作者在序言中说了什么',
      li: [
        '人们早就需要一本机械运动的汇编，因此编成此书。',
        '内容最早分五卷刊登在《American Artisan》杂志上。',
        '超过四分之一的运动是新的，数量约为此前美国同类书籍的三倍。',
        '分类并不完整，但有详细的索引，图与文字对页排列，便于查找。'
      ]
    },
    why: {
      h: '为什么重要',
      p: [
        '在没有电脑和视频的年代，发明家和工程师把这本书当作图典，用来寻找能产生所需运动的机构。',
        '150年后的今天，同样的原理仍在机器中工作，比如自行车链条、钟表的擒纵机构和发动机的曲柄。',
        '这本书属于公有领域，任何人都可以阅读，并以此为基础进行制作。'
      ]
    },
    how: {
      h: '如何使用本网站',
      li: (d) => [
        '在列表中选择一幅版画，即可浏览507种运动。',
        `已完成3D模型的运动（目前 ${d} / 507）可以真正动起来。我们按书中顺序从第1号开始制作。`,
        '如果版画不好理解，请先阅读“简单说明”标签。'
      ]
    },
    more: { h: '更多', ext: '也值得一看 — 507movements.com（会动的版画，内容版权属于该网站）' },
    toList: '前往运动列表'
  },
  hi: {
    eyebrow: 'परिचय',
    title: '150 साल पहले का मशीनों का चित्र-कोश',
    book: {
      h: 'यह किताब',
      p: [
        '“Five Hundred and Seven Mechanical Movements” (507 यांत्रिक गतियाँ) पहली बार 1868 में छपी थी। यहाँ दिखाई गई सामग्री 1871 के संस्करण (कॉर्नेल विश्वविद्यालय पुस्तकालय की प्रति) का स्कैन है।',
        'इसे हेनरी टी. ब्राउन ने संकलित किया था, जिन्हें शीर्षक पृष्ठ पर “American Artisan” पत्रिका का संपादक बताया गया है। प्रकाशक न्यूयॉर्क की Brown, Coombs & Co. थी।',
        'उपशीर्षक इसका दायरा बताता है: गतिकी, द्रवगतिकी, द्रवस्थैतिकी, वायवीय यंत्र, भाप इंजन, चक्की और अन्य गियर, प्रेस, घड़ीसाज़ी और विविध मशीनों में महत्वपूर्ण गतियाँ, जिनमें कई पहले कभी नहीं छपी थीं और कुछ हाल ही में आई थीं।'
      ]
    },
    layout: {
      h: 'किताब की बनावट',
      p: [
        'हर बाएँ पृष्ठ पर नौ या दस चित्र हैं, और सामने के दाएँ पृष्ठ पर उन्हीं नंबरों के विवरण हैं। लेखक ने प्रस्तावना में लिखा कि आमने-सामने की यह व्यवस्था खोजना आसान बनाती है।',
        'गतियाँ पृष्ठ 122 पर संख्या 507 के साथ खत्म होती हैं, उसके बाद उस समय के विज्ञापन हैं।'
      ]
    },
    preface: {
      h: 'प्रस्तावना में लेखक क्या कहते हैं',
      li: [
        'यांत्रिक गतियों के संग्रह की लंबे समय से ज़रूरत थी, इसलिए यह किताब बनाई गई।',
        'सामग्री पहले “American Artisan” पत्रिका में पाँच खंडों में छपी थी।',
        'एक चौथाई से ज़्यादा गतियाँ नई थीं, और इसमें पहले की किसी भी अमेरिकी किताब से लगभग तीन गुना गतियाँ थीं।',
        'वर्गीकरण पूरा नहीं है, पर विस्तृत अनुक्रमणिका और आमने-सामने चित्र व पाठ से खोजना आसान है।'
      ]
    },
    why: {
      h: 'यह क्यों महत्वपूर्ण है',
      p: [
        'कंप्यूटर और वीडियो से पहले, आविष्कारक और इंजीनियर इस किताब को चित्र-कोश की तरह इस्तेमाल करते थे, ताकि ज़रूरी गति देने वाला तंत्र ढूँढ सकें।',
        'वही सिद्धांत 150 साल बाद भी मशीनों के अंदर काम करते हैं — साइकिल की चेन, घड़ी का एस्केपमेंट और इंजन का क्रैंक इसके उदाहरण हैं।',
        'यह किताब सार्वजनिक क्षेत्र (पब्लिक डोमेन) में है, इसलिए कोई भी इसे पढ़ सकता है और इससे कुछ बना सकता है।'
      ]
    },
    how: {
      h: 'इस साइट का उपयोग कैसे करें',
      li: (d) => [
        'सूची में कोई चित्र चुनकर 507 गतियाँ देखें।',
        `जिन गतियों का 3D मॉडल तैयार है (अभी ${d} / 507), वे सच में चलती हैं। ये किताब के क्रम में संख्या 1 से बनाई जा रही हैं।`,
        'अगर कोई चित्र समझना मुश्किल लगे, तो पहले “आसान व्याख्या” टैब पढ़ें।'
      ]
    },
    more: { h: 'और देखें', ext: 'यह भी देखने लायक — 507movements.com (चलते हुए चित्र; उस सामग्री का अधिकार उसी साइट का है)' },
    toList: 'गतियों की सूची पर जाएँ'
  },
  ar: {
    eyebrow: 'نبذة',
    title: 'معجم مصوّر للآلات قبل 150 عامًا',
    book: {
      h: 'عن الكتاب',
      p: [
        'نُشر كتاب «Five Hundred and Seven Mechanical Movements» (خمسمئة وسبع حركات ميكانيكية) لأول مرة عام 1868. والمادة المعروضة هنا مسح ضوئي لطبعة عام 1871 (نسخة مكتبة جامعة كورنيل).',
        'جمعه هنري ت. براون، الذي تصفه صفحة العنوان بأنه محرر مجلة «American Artisan»، ونشرته شركة Brown, Coombs & Co. في نيويورك.',
        'يحدّد العنوان الفرعي نطاقه: الحركات المهمة في الديناميكا والهيدروليكا والهيدروستاتيكا والهوائيات والمحركات البخارية وتروس الطواحين وغيرها والمكابس وصناعة الساعات والآلات المتنوعة، ومنها كثير لم يُنشر من قبل وبعضها لم يظهر إلا حديثًا.'
      ]
    },
    layout: {
      h: 'كيف رُتّب الكتاب',
      p: [
        'تضم كل صفحة يسرى تسعة أو عشرة نقوش، وتضم الصفحة اليمنى المقابلة الأوصاف بالأرقام نفسها. وذكر المؤلف في المقدمة أن هذا الترتيب المتقابل يسهّل البحث.',
        'تنتهي الحركات بالرقم 507 في الصفحة 122، وتليها إعلانات من ذلك العصر.'
      ]
    },
    preface: {
      h: 'ما يقوله المؤلف في المقدمة',
      li: [
        'جُمع الكتاب لأن الحاجة إلى مجموعة من الحركات الميكانيكية كانت قائمة منذ زمن طويل.',
        'ظهر المحتوى أولًا في مجلة «American Artisan» على مدى خمسة مجلدات.',
        'أكثر من ربع الحركات جديد، ويضم الكتاب نحو ثلاثة أضعاف ما في أي كتاب أمريكي سابق.',
        'التصنيف ليس كاملًا، لكن الفهرس المفصّل وتقابل الصور والنصوص يسهّلان البحث.'
      ]
    },
    why: {
      h: 'لماذا هو مهم',
      p: [
        'قبل الحواسيب والفيديو، كان المخترعون والمهندسون يستخدمون هذا الكتاب معجمًا مصوّرًا ليجدوا الآلية التي تُنتج الحركة التي يحتاجونها.',
        'وما زالت المبادئ نفسها تعمل داخل الآلات بعد 150 عامًا، ومن أمثلتها سلسلة الدراجة وميزان الساعة وذراع تدوير المحرك.',
        'الكتاب في الملك العام، فيمكن لأي شخص أن يقرأه ويبني عليه.'
      ]
    },
    how: {
      h: 'كيف تستخدم هذا الموقع',
      li: (d) => [
        'اختر نقشًا من القائمة لتتصفح الحركات الـ507.',
        `الحركات التي اكتمل نموذجها ثلاثي الأبعاد (حتى الآن ${d} / 507) تتحرك فعلًا. ونصنعها بترتيب الكتاب بدءًا من الرقم 1.`,
        'إذا صعب عليك فهم نقش ما، فاقرأ تبويب «شرح مبسّط» أولًا.'
      ]
    },
    more: { h: 'المزيد', ext: 'يستحق الزيارة أيضًا — 507movements.com (نقوش متحركة؛ حقوق ذلك المحتوى لذلك الموقع)' },
    toList: 'إلى قائمة الحركات'
  }
};
