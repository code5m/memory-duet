(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MemoryDuetCatalog = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // One canonical content source. The WeChat bundle is an exact copy of this file.
  var DIMENSIONS = [
    ['subject','学科领域'],['topic','专题内容'],['grade','学习阶段'],
    ['goal','学习目标'],['skill','核心能力'],['method','主记忆法'],
    ['auxMethod','辅助记忆法'],['difficulty','难度等级'],['duration','学习时长'],
    ['format','内容形式'],['material','材料类型'],['language','学习语言'],
    ['exam','考试场景'],['scenario','应用场景'],['theme','知识主题'],
    ['knowledge','知识类型'],['cognitive','认知目标'],['recall','回忆方式'],
    ['order','顺序要求'],['visual','视觉提示'],['sensory','感官形式'],
    ['group','学习模式'],['frequency','建议频率'],['source','内容出处'],
    ['creator','创作来源'],['path','学习路径'],['tags','知识标签'],
    ['status','学习状态'],['review','复习计划'],['saved','收藏状态']
  ].map(function (item) { return {key:item[0],label:item[1]}; });

  var TOPICS = [
    {id:'en-verbs',title:'借入与借出',subtitle:'一个动作，两种视角',subject:'英语',icon:'☂',tone:'violet',grade:'中学',goal:'准确运用',skill:'词义辨析',theme:'日常表达',knowledge:'易混词',exam:'日常英语',scenario:'口语交流',tags:['动词','英语表达']},
    {id:'en-prefix',title:'词根词缀实验室',subtitle:'用结构理解陌生单词',subject:'英语',icon:'✳',tone:'peach',grade:'中学',goal:'理解含义',skill:'词汇构词',theme:'词汇拓展',knowledge:'构词法',exam:'英语阅读',scenario:'阅读理解',tags:['前缀','英语词汇']},
    {id:'en-sounds',title:'英语听辨双胞胎',subtitle:'从读音到拼写的区别',subject:'英语',icon:'♫',tone:'mint',grade:'中学',goal:'区分读音',skill:'发音辨析',theme:'语音基础',knowledge:'音素',exam:'日常英语',scenario:'听力练习',tags:['英语发音','音标']},
    {id:'cn-poem',title:'月光里的古诗',subtitle:'用分镜还原诗句顺序',subject:'语文',icon:'☾',tone:'blue',grade:'小学',goal:'精确背诵',skill:'顺序记忆',theme:'古诗词',knowledge:'诗句',exam:'课文背诵',scenario:'课堂学习',tags:['古诗','李白']},
    {id:'cn-idiom',title:'成语故事剧场',subtitle:'从情境理解成语含义',subject:'语文',icon:'✺',tone:'peach',grade:'小学',goal:'理解运用',skill:'语义理解',theme:'成语',knowledge:'成语含义',exam:'语文阅读',scenario:'表达写作',tags:['成语','故事']},
    {id:'cn-text',title:'春天的四句诗',subtitle:'先看画面，再独立还原',subject:'语文',icon:'🌱',tone:'mint',grade:'小学',goal:'精确背诵',skill:'顺序记忆',theme:'古诗词',knowledge:'诗句',exam:'课文背诵',scenario:'课堂学习',tags:['古诗','孟浩然']},
    {id:'math-fraction',title:'分数变形记',subtitle:'数值相等，写法不同',subject:'数学',icon:'½',tone:'blue',grade:'小学',goal:'概念理解',skill:'等值转换',theme:'数与代数',knowledge:'分数',exam:'数学基础',scenario:'解题训练',tags:['分数','计算']},
    {id:'math-area',title:'长方形的秘密',subtitle:'让公式变成可观察的面积',subject:'数学',icon:'▦',tone:'violet',grade:'小学',goal:'公式应用',skill:'计算迁移',theme:'图形几何',knowledge:'面积与周长',exam:'数学基础',scenario:'解题训练',tags:['几何','单位']},
    {id:'math-algebra',title:'代数恒等式积木',subtitle:'看见公式背后的结构',subject:'数学',icon:'∑',tone:'peach',grade:'中学',goal:'公式应用',skill:'符号推导',theme:'代数',knowledge:'恒等式',exam:'中学数学',scenario:'解题训练',tags:['代数','公式']},
    {id:'science-water',title:'一滴水的旅行',subtitle:'过程有顺序，理解有因果',subject:'科学',icon:'◌',tone:'blue',grade:'小学',goal:'过程理解',skill:'因果推理',theme:'自然现象',knowledge:'科学过程',exam:'科学常识',scenario:'自然观察',tags:['水循环','天气']},
    {id:'science-space',title:'星球漫游指南',subtitle:'记住地球与太阳的关系',subject:'科学',icon:'✦',tone:'violet',grade:'小学',goal:'事实记忆',skill:'科学概念',theme:'天文',knowledge:'地球与太阳',exam:'科学常识',scenario:'自然观察',tags:['宇宙','天文']},
    {id:'science-bio',title:'生命的说明书',subtitle:'用结构理解遗传与生态',subject:'科学',icon:'❀',tone:'mint',grade:'中学',goal:'概念理解',skill:'概念解释',theme:'生命科学',knowledge:'生物学',exam:'科学常识',scenario:'课堂学习',tags:['生物','生态']},
    {id:'history-dynasties',title:'中国朝代时间线',subtitle:'分组理解先后关系',subject:'历史',icon:'⌛',tone:'peach',grade:'中学',goal:'顺序回忆',skill:'时间排序',theme:'中国历史',knowledge:'朝代顺序',exam:'历史常识',scenario:'课堂学习',tags:['朝代','时间线']},
    {id:'geo-earth',title:'认识我们居住的地球',subtitle:'方位与地理基础概念',subject:'地理',icon:'◎',tone:'blue',grade:'中学',goal:'事实记忆',skill:'空间认知',theme:'地球地理',knowledge:'地理概念',exam:'地理基础',scenario:'地图阅读',tags:['地球','地图']},
    {id:'code-web',title:'互联网入门',subtitle:'看懂网页和基础逻辑',subject:'编程',icon:'⌘',tone:'mint',grade:'通用',goal:'理解运用',skill:'技术概念',theme:'Web 基础',knowledge:'编程术语',exam:'自学入门',scenario:'项目实践',tags:['HTML','算法']},
    {id:'code-git',title:'Git 工作流速记',subtitle:'用实际操作理解命令',subject:'编程',icon:'⌥',tone:'violet',grade:'通用',goal:'实际操作',skill:'开发流程',theme:'版本控制',knowledge:'工具命令',exam:'自学入门',scenario:'项目实践',tags:['Git','工具']},
    {id:'work-method',title:'工作方法卡片',subtitle:'让概念回到行动步骤',subject:'专业知识',icon:'◈',tone:'peach',grade:'成人',goal:'实际操作',skill:'流程理解',theme:'工作方法',knowledge:'工作流程',exam:'职场学习',scenario:'工作实践',tags:['PDCA','SOP']},
    {id:'life-check',title:'出门不遗漏',subtitle:'从生活清单练习顺序回忆',subject:'生活技能',icon:'⌂',tone:'mint',grade:'通用',goal:'准确回忆',skill:'清单记忆',theme:'生活管理',knowledge:'操作清单',exam:'日常生活',scenario:'出行准备',tags:['清单','生活']},
    {id:'memory-digits',title:'数字零失误',subtitle:'前导零必须完整保留',subject:'记忆训练',icon:'03',tone:'blue',grade:'通用',goal:'精确回忆',skill:'数字编码',theme:'数字训练',knowledge:'数字顺序',exam:'记忆训练',scenario:'限时训练',tags:['数字','组块']},
    {id:'memory-tools',title:'记忆方法研究所',subtitle:'先选适用目标，再选方法',subject:'记忆训练',icon:'✿',tone:'violet',grade:'通用',goal:'方法选择',skill:'策略判断',theme:'记忆方法',knowledge:'学习策略',exam:'学习方法',scenario:'自主学习',tags:['记忆宫殿','主动回忆']},
    {id:'logic-basics',title:'逻辑推理入门',subtitle:'分清条件与结论',subject:'专业知识',icon:'◇',tone:'mint',grade:'成人',goal:'推理迁移',skill:'逻辑判断',theme:'形式逻辑',knowledge:'条件命题',exam:'能力训练',scenario:'工作实践',tags:['逻辑','推理']},
    {id:'econ-basics',title:'经济学微概念',subtitle:'用真实选择理解抽象概念',subject:'专业知识',icon:'◒',tone:'peach',grade:'成人',goal:'概念理解',skill:'经济思维',theme:'经济学',knowledge:'经济概念',exam:'常识拓展',scenario:'生活决策',tags:['经济','选择']}
  ];

  // id, topicId, title, method, cue, question, reference answer, explanation, minutes, recall type, visual
  var ENTRIES = [
    ['en-lend','en-verbs','把伞借给别人','画面','想象伞从你的手里递到朋友手里：你是给出的一方。','“我把相机借给朋友”中的“借出”，英语动词原形是什么？','lend','lend 是借出；borrow 表示借入。',3,'文字填空','动作方向'],
    ['en-borrow','en-verbs','从朋友那里借伞','联想','想象伞从朋友那里来到你手中：你是拿到的一方。','“我向朋友借一本书”中的“借入”，英语动词原形是什么？','borrow','borrow 是借入；lend 是借出。',3,'文字填空','方向对照'],
    ['en-un','en-prefix','给 happy 加上 un-','组块','un- 常表示“不”；把 un 和 happy 分成两块理解。','unhappy 的基本含义是什么？','不开心','un- + happy 在这里表示“不开心”。',3,'释义回忆','结构块'],
    ['en-re','en-prefix','rewrite：再写一次','组块','re- 常表示“再次”；re + write 就是再写。','rewrite 的常见含义是什么？','重写','前缀 re- 在此表示再次。',3,'释义回忆','结构块'],
    ['en-ship','en-sounds','ship 还是 sheep','语音辨析','ship /ʃɪp/ 是短元音 /ɪ/；sheep /ʃiːp/ 是长元音 /iː/。此卡提供文字音标，不含音频。','哪个单词表示“绵羊”？请写英文单词。','sheep','sheep 表示绵羊；ship 表示船。',4,'拼写回忆','音标对照'],
    ['en-ship2','en-sounds','看音标找单词','语音辨析','对照 /ʃɪp/ 与 /ʃiːp/，注意元音差异。','音标 /ʃɪp/ 对应哪个英文单词？','ship','ship /ʃɪp/ 表示船。',4,'拼写回忆','音标对照'],
    ['cn-moon1','cn-poem','举头之后是什么','分镜','月光 → 疑霜 → 抬头望月 → 低头思乡，按《静夜思》原诗顺序。','李白《静夜思》中，“举头望明月”的下一句是？','低头思故乡','完整诗句顺序以原作为准。',3,'原文回忆','连续分镜'],
    ['cn-moon2','cn-poem','疑霜之后是什么','分镜','想象地上的月光像霜，诗人接下来抬头看月亮。','李白《静夜思》中，“疑是地上霜”的下一句是？','举头望明月','先确认诗句顺序，再脱离画面独立回忆。',3,'原文回忆','连续分镜'],
    ['cn-idiom1','cn-idiom','画蛇添足','故事','蛇已画好，又给它添脚，反而坏事。','比喻做了多余的事反而不恰当的成语是什么？','画蛇添足','重在理解“多余的举动”。',3,'文字填空','情节场景'],
    ['cn-idiom2','cn-idiom','守株待兔','故事','农夫守着树桩，盼望兔子再次撞上来。','比喻拘泥于偶然经验、不主动努力的成语是什么？','守株待兔','故事是助记线索，不能把它当现实规律。',3,'文字填空','情节场景'],
    ['cn-spring1','cn-text','春眠不觉晓','分镜','春天清晨，屋外传来鸟儿鸣叫。','孟浩然《春晓》中，“春眠不觉晓”的下一句是？','处处闻啼鸟','诗句顺序需独立还原。',3,'原文回忆','连续分镜'],
    ['cn-spring2','cn-text','夜来风雨声','分镜','夜里有风雨，醒来想到花落了多少。','孟浩然《春晓》中，“夜来风雨声”的下一句是？','花落知多少','按原诗核对字形和顺序。',3,'原文回忆','连续分镜'],
    ['math-half','math-fraction','二分之一的等值分数','图解','把一个整体平分两份涂一份；再平分四份涂两份，面积相同。','1/2 等于分母为 4 的哪个分数？','2/4','分子分母同乘 2，分数值不变。',4,'公式结果','几何示意'],
    ['math-decimal','math-fraction','四分之三的小数','图解','把一格分成四份，涂三份；对应百分之七十五。','3/4 写成小数是多少？','0.75','3 ÷ 4 = 0.75。',4,'公式结果','几何示意'],
    ['math-area','math-area','长方形面积','图解','在长为 6 米、宽为 4 米的网格中，每格 1 平方米。','长 6 米、宽 4 米的长方形面积是多少平方米？','24','面积 = 长 × 宽 = 6 × 4 = 24 平方米。',4,'公式结果','网格图'],
    ['math-perimeter','math-area','长方形周长','图解','沿着长方形四条边走一圈，长和宽各出现两次。','长 5 厘米、宽 3 厘米的长方形周长是多少厘米？','16','周长 = 2 × (5 + 3) = 16 厘米。',4,'公式结果','几何示意'],
    ['math-square','math-algebra','平方差公式','组块','两平方相减：分成“一减一加”两个因式。','a² − b² 因式分解后是什么？','(a-b)(a+b)','(a − b)(a + b) = a² − b²。',5,'公式原样','结构块'],
    ['math-identity','math-algebra','完全平方公式','组块','(a+b) 的平方，包含两个平方项和一个 2ab。','(a+b)² 展开后是什么？','a²+2ab+b²','按 a²、2ab、b² 三部分依序还原。',5,'公式原样','结构块'],
    ['sci-evap','science-water','水蒸气从哪里来','过程图','太阳加热地表水，部分液态水变成水蒸气。','液态水变成水蒸气的过程叫什么？','蒸发','蒸发是液体表面发生的汽化现象。',4,'概念回忆','流程箭头'],
    ['sci-condense','science-water','水汽凝结成小水滴','过程图','水汽遇冷凝结成小水滴，许多小水滴可参与云的形成。','水蒸气变成液态小水滴的过程叫什么？','凝结','凝结是气态变成液态的过程。',4,'概念回忆','流程箭头'],
    ['sci-sun','science-space','太阳系的恒星','语义关联','行星围绕太阳公转，太阳自身是一颗恒星。','太阳系中的恒星叫什么？','太阳','太阳系只有一颗恒星：太阳。',3,'事实回忆','关系图'],
    ['sci-day','science-space','白天和黑夜','图解','地球自转，不同地区交替朝向太阳。','地球上的昼夜交替主要由什么运动造成？','地球自转','昼夜交替主要来自地球的自转。',4,'概念回忆','关系图'],
    ['sci-dna','science-bio','DNA 的形状','画面','想象一把扭转的梯子；这是双螺旋结构的形象线索。','DNA 经典结构模型通常称为什么结构？','双螺旋','DNA 的经典模型为双螺旋结构。',4,'概念回忆','结构图'],
    ['sci-chain','science-bio','简单食物链','关系图','青草被兔子吃，兔子可能被狐狸吃；箭头指向获取能量者。','青草 → 兔子 → 狐狸，兔子后面是谁？','狐狸','箭头表示食物和能量的传递方向。',3,'顺序回忆','关系图'],
    ['his-tang','history-dynasties','唐与宋的先后','时间线','在中国历史时间线上，唐朝位于宋朝之前。','唐朝和宋朝，哪个朝代更早？','唐朝','此卡只比较两个朝代的先后。',3,'事实回忆','时间线'],
    ['his-qin','history-dynasties','秦汉相接','时间线','先秦朝，再汉朝；以两段顺序线记忆。','秦朝之后建立的统一王朝是哪一个？','汉朝','汉朝分西汉和东汉，中间有新朝；此处是简化的朝代主线。',3,'事实回忆','时间线'],
    ['geo-ocean','geo-earth','最大的海洋','地图','在世界地图上找到跨越广阔太平洋的海域。','世界面积最大的洋是什么？','太平洋','太平洋是地球面积最大的洋。',3,'事实回忆','地图'],
    ['geo-equator','geo-earth','赤道在哪里','地图','想象沿着地球中部绕一圈的纬线。','赤道的纬度是多少度？','0','赤道定义为纬度 0°。',3,'事实回忆','地图'],
    ['code-link','code-web','HTML 超链接','真实操作','网页中 a 元素常用于创建超链接。','HTML 中常用哪个标签表示超链接？','a','完整写法通常为 <a href="...">链接</a>。',4,'代码回忆','代码示意'],
    ['code-binary','code-web','二分查找的前提','正反例','如果列表已排序，可以每次排除一半区间。','标准二分查找要求待查找数据具有什么顺序特征？','有序','典型二分查找需要数据按一致规则排序。',4,'概念回忆','对比图'],
    ['git-status','code-git','工作区状态查看','真实操作','改文件后先查看工作区有哪些变更。','查看 Git 工作区状态的命令是什么？','git status','git status 用于显示工作树状态。',3,'命令回忆','终端'],
    ['git-diff','code-git','查看尚未暂存的差异','真实操作','修改尚未暂存的文件时，可用 git diff 查看差异。','查看工作区未暂存改动的常用 Git 命令是什么？','git diff','默认 git diff 展示尚未暂存的差异。',3,'命令回忆','终端'],
    ['work-pdca','work-method','PDCA 循环','组块','计划 Plan → 执行 Do → 检查 Check → 处理 Act。','PDCA 中字母 C 对应哪个英文词？','Check','四个字母按过程顺序记忆。',4,'文字填空','流程箭头'],
    ['work-sop','work-method','SOP 是什么','语义关联','把重复性工作写成可执行的标准步骤。','SOP 通常指哪一种操作文件？','标准操作程序','SOP = Standard Operating Procedure。',4,'释义回忆','操作清单'],
    ['life-items','life-check','三件随身物品','手指','示例清单：拇指钥匙、食指手机、中指工牌。不是你的个人真实清单。','按照示例顺序写出三件物品，用顿号分隔。','钥匙、手机、工牌','这只是三项练习示例；正式清单要换成你自己的。',3,'顺序回忆','手指示意'],
    ['life-order','life-check','出门检查顺序','组块','示例流程：关窗 → 关灯 → 锁门。仅作回忆训练示例。','示例流程中，关灯之后要做什么？','锁门','可按实际居家安全需求修改流程。',3,'顺序回忆','流程箭头'],
    ['mem-zero','memory-digits','保留前导零','组块','把 031427 分成 03 / 14 / 27，依次复述，首位 0 不可漏。','写出完整六位练习码（包含前导零）。','031427','只接受完整六位数字。',3,'精确数字','结构块'],
    ['mem-seven','memory-digits','另一个六位练习码','组块','把 007314 分成 00 / 73 / 14；不能把 00 当作空白。','写出完整六位练习码。','007314','首部两个零都必须保留。',3,'精确数字','结构块'],
    ['mem-palace','memory-tools','记忆宫殿的前提','语义关联','地点记忆需要学习者熟悉且桩位够用的路线；不代替确认熟悉程度。','地点记忆法正式使用之前，需要先确认路线是否怎样？','熟悉','正式学习应确认路线熟悉度及桩位容量。',4,'概念回忆','空间路线'],
    ['mem-recall','memory-tools','什么叫独立回忆','正反例','先遮住答案再回答，和看着答案说一遍不是同一回事。','不看答案与提示、自己给出答案的练习叫什么？','独立回忆','提示后答对需单独记录，不能算独立正确。',4,'概念回忆','正反对照'],
    ['logic-if','logic-basics','条件命题的逆否','正反例','如果 P 则 Q，与如果非 Q 则非 P 逻辑等价。','“如果 P 则 Q”的逆否命题是？','如果非Q则非P','逆否命题和原命题等价；逆命题未必等价。',5,'规则回忆','逻辑图'],
    ['logic-not','logic-basics','否定全称命题','正反例','“所有人都通过”不成立，意味着至少有一人没有通过。','“所有人都通过”的否定是什么？','至少一人没有通过','注意全称与存在量词的转换。',5,'规则回忆','正反对照'],
    ['econ-cost','econ-basics','机会成本','正反例','选择 A 就放弃了其他选择；机会成本常指被放弃的最佳替代选项的价值。','选择一个方案时，被放弃的最佳替代方案的价值叫什么？','机会成本','不要把所有放弃的选项简单相加。',4,'概念回忆','选择分叉'],
    ['econ-sunk','econ-basics','沉没成本','正反例','已经花出且无法收回的费用，不应仅因其已支付就决定继续投入。','已经发生且无法收回的成本叫什么？','沉没成本','决策还需看未来收益和未来成本。',4,'概念回忆','正反对照']
  ];

  var defaultBySubject = {
    '英语':{language:'英语',material:'词汇 / 文本',source:'原创教学示例',path:'语言表达'},
    '语文':{language:'中文',material:'经典原文 / 文本',source:'经典作品与教学示例',path:'语文积累'},
    '数学':{language:'数学符号 / 中文',material:'公式 / 图形',source:'基础数学示例',path:'数学基础'},
    '科学':{language:'中文',material:'科学概念 / 图示',source:'基础科学示例',path:'科学探究'},
    '历史':{language:'中文',material:'历史时间线',source:'通识教学示例',path:'人文素养'},
    '地理':{language:'中文',material:'地图 / 文本',source:'地理通识示例',path:'人文素养'},
    '编程':{language:'代码 / 中文',material:'代码 / 操作',source:'公开技术知识示例',path:'技术基础'},
    '专业知识':{language:'中文 / 符号',material:'概念 / 案例',source:'通识教学示例',path:'职业学习'},
    '生活技能':{language:'中文',material:'生活清单',source:'虚构教学示例',path:'日常效率'},
    '记忆训练':{language:'数字 / 中文',material:'练习材料',source:'原创训练示例',path:'记忆训练'}
  };

  var topicsById = {};
  TOPICS.forEach(function (topic) { topicsById[topic.id] = topic; });
  var LESSONS = ENTRIES.map(function (row, index) {
    var t = topicsById[row[1]];
    if (!t) throw new Error('Unknown topic ' + row[1]);
    var base = defaultBySubject[t.subject];
    var method = row[3], minutes = row[8];
    return {
      id:row[0],topicId:t.id,topic:t.title,subject:t.subject,icon:t.icon,tone:t.tone,
      title:row[2],method:method,cue:row[4],question:row[5],answer:row[6],
      explanation:row[7],minutes:minutes,recall:row[9],visual:row[10],
      grade:t.grade,goal:t.goal,skill:t.skill,theme:t.theme,knowledge:t.knowledge,
      exam:t.exam,scenario:t.scenario,tags:t.tags.slice(),difficulty:index%6===0?'进阶':'入门',
      auxMethod:'不需要',duration:minutes <= 3?'3 分钟内':'4–6 分钟',
      format:method==='分镜'?'分镜卡':method==='组块'?'组块卡':'互动学习卡',
      material:base.material,language:base.language,cognitive:t.goal,
      order:/(顺序|原文|精确数字)/.test(row[9])?'严格顺序':'无需顺序',
      sensory:method==='语音辨析'?'文字音标':'视觉 / 文字',group:'独立学习',
      frequency:'自主安排',source:base.source,creator:'Memory Duet 编辑示例',
      path:base.path
    };
  });

  function normalizeAnswer(value) {
    return String(value == null ? '' : value).trim().toLowerCase()
      .replace(/[\s\u3000]/g,'').replace(/[。！!，,、.]/g,'')
      .replace(/[（）]/g,function (ch) { return ch==='（'?'(':')'; })
      .replace(/[−－]/g,'-');
  }
  function evaluateAnswer(lesson, answer) {
    var accepted = [lesson.answer].concat(lesson.aliases || []);
    return accepted.some(function (a) { return normalizeAnswer(a) === normalizeAnswer(answer); });
  }
  function progressState(id, attempts, now) {
    var history = attempts && attempts[id] || [];
    if (!history.length) return '未开始';
    var last = history[history.length-1];
    if (last.outcome === 'incorrect') return '需巩固';
    if (last.outcome === 'prompted-correct') return '提示后答对';
    var successes = history.filter(function (x) { return x.outcome==='independent-correct'; }).length;
    var gaps = [1,3,7,14];
    var days = gaps[Math.min(Math.max(0,successes-1),gaps.length-1)];
    var lastTime = Date.parse(last.at);
    if (!Number.isFinite(lastTime)) return '已练习';
    return (now || Date.now()) >= lastTime + days*86400000 ? '待复习' : '已练习';
  }
  function facetValue(lesson, key, state) {
    state = state || {};
    if (key==='status') return progressState(lesson.id,state.attempts,state.now);
    if (key==='review') {
      var status=progressState(lesson.id,state.attempts,state.now);
      return status==='待复习'||status==='需巩固'?'今日可复习':status==='已练习'?'未来待复习':'未安排';
    }
    if (key==='saved') return state.saved && state.saved[lesson.id]?'已收藏':'未收藏';
    return lesson[key] == null ? '未分类' : lesson[key];
  }
  function facetOptions(lessons, key, state) {
    var seen={};
    lessons.forEach(function (lesson) {
      var val = facetValue(lesson,key,state);
      (Array.isArray(val)?val:[val]).forEach(function (v) { if (v) seen[String(v)]=true; });
    });
    return Object.keys(seen).sort(function(a,b){return a.localeCompare(b,'zh-CN');});
  }
  function filterLessons(lessons, options, state) {
    options=options||{};
    var query=String(options.search||'').trim().toLowerCase();
    var output=lessons.filter(function (lesson) {
      if (options.onlySaved && !(state && state.saved && state.saved[lesson.id])) return false;
      if (options.dimension && options.value && options.value!=='全部') {
        var val=facetValue(lesson,options.dimension,state);
        if (!(Array.isArray(val)?val:[val]).includes(options.value)) return false;
      }
      return !query || [lesson.title,lesson.subject,lesson.topic,lesson.cue,lesson.question,lesson.answer].concat(lesson.tags||[])
        .join(' ').toLowerCase().includes(query);
    });
    if (options.sort==='title') output.sort(function(a,b){return a.title.localeCompare(b.title,'zh-CN');});
    if (options.sort==='short') output.sort(function(a,b){return a.minutes-b.minutes;});
    return output;
  }
  function topicLessonCount(id) { return LESSONS.filter(function(x){return x.topicId===id;}).length; }
  return {DIMENSIONS:DIMENSIONS,TOPICS:TOPICS,LESSONS:LESSONS,
    topicsById:topicsById,normalizeAnswer:normalizeAnswer,evaluateAnswer:evaluateAnswer,
    progressState:progressState,facetValue:facetValue,facetOptions:facetOptions,
    filterLessons:filterLessons,topicLessonCount:topicLessonCount};
});