(function(root,factory){
  "use strict";
  if(typeof module==="object" && module.exports) module.exports=factory;
  if(root && root.MemoryDuetCatalog) factory(root.MemoryDuetCatalog);
})(typeof globalThis!=="undefined"?globalThis:this,function(C){
  "use strict";
  if(C.expandedV3)return C;
  C.expandedV3=true;
  const newTopics=[
    ["ai-literacy","AI 与信息判断","不让生成式 AI 的流畅回答替你判断事实","编程","✧","violet","通用","数字素养","AI 概念"],
    ["art-color","色彩与设计入门","从光的混合开始理解颜色","艺术","◉","peach","通用","色彩观察","基础设计"],
    ["finance-basics","生活中的财务常识","先分清收入、支出与风险","生活技能","◈","mint","成人","理财基础","生活决策"],
    ["study-strategies","更有效的学习策略","区分看懂、记住与会运用","记忆训练","✿","blue","通用","学习科学","学习方法"]
  ];
  newTopics.forEach(function(r){
    const t={id:r[0],title:r[1],subtitle:r[2],subject:r[3],icon:r[4],tone:r[5],
      grade:r[6],goal:"理解应用",skill:r[7],theme:r[8],knowledge:r[8],
      exam:"自主学习",scenario:"生活学习",tags:[r[7],r[8]]};
    C.TOPICS.push(t);C.topicsById[t.id]=t;
  });
  const cases={
    "en-verbs":[
      ["en-give","lend 后面常用的介词","把书借给朋友时，lend 的接收者常由 to 引出。","I lend a book ___ my friend. 空格填哪个介词？","to","lend something to somebody 表示把某物借给某人。","联想"],
      ["en-from","borrow 后面常用的介词","从朋友那里借书时，borrow 的来源常由 from 引出。","I borrow a book ___ my friend. 填入哪个介词？","from","borrow something from somebody 表示向某人借入某物。","正反例"],
      ["en-lend-person","分辨借入者和借出者","小美从阿华那里拿来一本书：小美 borrow，阿华 lend。","书从阿华传到小美，哪个人是 lender（借出方）？","阿华","比较动作方向后再独立还原身份。","画面"]
    ],
    "en-prefix":[
      ["en-restart","restart 是再次开始","re- 在 restart 中表示再次，start 表示开始。","restart 通常表示什么？","重新开始","re- 是常见前缀，但并非所有以 re 开头的词都能这样拆分。","组块"],
      ["en-unfair","unfair 的含义","un- 在 unfair 中表示不，fair 表示公平。","unfair 的常见中文含义是什么？","不公平","与 fair 对比，独立回答。","正反例"],
      ["en-preheat","预热怎么说","pre- 在 preheat 中表示事先，heat 表示加热。","preheat 的中文常见含义是什么？","预热","注意前缀在具体单词中的实际意义。","组块"]
    ],
    "en-sounds":[
      ["en-seat","seat 和 sit 的拼写","seat /siːt/ 与 sit /sɪt/ 元音和拼写均不同。","表示“座位”的英文单词是什么？","seat","本卡展示文字音标，不提供真人发音。","语音辨析"],
      ["en-sit","sitting 的动词原形","sit /sɪt/ 表示坐，seat /siːt/ 可表示座位。","表示“坐”的英语动词原形是什么？","sit","词义要结合句子判断。","语音辨析"],
      ["en-fool","full 与 fool","full /fʊl/ 表示满的，fool /fuːl/ 可表示傻瓜。","表示“满的”的英文单词是什么？","full","书写字母差异和元音发音都需检查。","语音辨析"]
    ],
    "cn-poem":[
      ["cn-sheng1","床前一句","李白《静夜思》按“床前 → 疑霜 → 举头 → 低头”的顺序。","《静夜思》中，“床前明月光”的下一句是什么？","疑是地上霜","按指定的《静夜思》通行版本核对。","分镜"],
      ["cn-sheng2","开篇的五个字","第一镜：诗人看到床前洒下的月光。","《静夜思》通行版本的第一句是什么？","床前明月光","文字和顺序都要核对。","画面"],
      ["cn-sheng3","静夜思作者","把诗题《静夜思》与唐代诗人李白相连。","《静夜思》的作者是谁？","李白","作者和原文需要分别记忆。","语义关联"]
    ],
    "cn-idiom":[
      ["cn-idiom3","亡羊补牢","羊丢失后及时修好羊圈，避免继续损失。","比喻出了问题后及时补救的成语是什么？","亡羊补牢","比喻含义与故事本身要区分。","故事"],
      ["cn-idiom4","刻舟求剑","剑从船上落水，人在船上刻记号却忽略船会移动。","比喻拘泥成法、不知情况已变化的成语是什么？","刻舟求剑","理解相对位置变化是关键。","画面"],
      ["cn-idiom5","井底之蛙","井中的青蛙从狭小井口观察天空，见识受到限制。","比喻见识狭窄的人常用哪个成语？","井底之蛙","不要将故事内容当科学事实。","故事"]
    ],
    "cn-text":[
      ["cn-spring3","听到鸟鸣之后","《春晓》是春眠不觉晓 → 处处闻啼鸟 → 夜来风雨声 → 花落知多少。","“处处闻啼鸟”的下一句是什么？","夜来风雨声","按原诗准确记忆。","分镜"],
      ["cn-spring4","春晓作者","《春晓》是唐代诗人孟浩然的作品。","《春晓》的作者是谁？","孟浩然","作者信息不同于正文背诵。","语义关联"],
      ["cn-spring5","结尾一问","诗人在风雨过后的清晨想到庭院落花的数量。","《春晓》的最后一句是什么？","花落知多少","按原诗核对字词。","画面"]
    ],
    "math-fraction":[
      ["math-sixths","三分之二的等值分数","分子分母都乘 2，2/3 = 4/6。","2/3 等于分母为 6 的哪个分数？","4/6","分子和分母须同时乘同一个非零数。","图解"],
      ["math-third","比较 1/2 和 1/3","同样大小的整体分成两份，每份大于分成三份的每份。","1/2 和 1/3，哪一个更大？","1/2","比较分数前必须确认整体相同。","正反例"],
      ["math-fifth","0.2 的分数形式","0.2 = 2/10，约分得到 1/5。","0.2 写成最简分数是什么？","1/5","十分之二约去公因数 2。","图解"]
    ],
    "math-area":[
      ["math-square-area","正方形的面积","边长 4 厘米，4×4 个单位小方格。","边长 4 厘米的正方形面积是多少平方厘米？","16","面积单位是平方厘米。","图解"],
      ["math-rect-perimeter","更换边长求周长","长 8 米、宽 3 米，周长 2×(8+3)。","长 8 米、宽 3 米的长方形周长是多少米？","22","周长是所有边长度之和。","图解"],
      ["math-unit","面积单位与周长单位","周长测量长度，面积测量二维区域大小。","面积计算通常使用“米”还是“平方米”作单位？","平方米","单位不能混用。","正反例"]
    ],
    "math-algebra":[
      ["math-minus-square","差的平方展开","(a-b)² = a²-2ab+b²，中间是负号。","(a-b)² 展开后是什么？","a²-2ab+b²","特别注意中间项 -2ab。","组块"],
      ["math-fact9","x²−9 因式分解","9=3²，套用平方差公式。","x²-9 因式分解后是什么？","(x-3)(x+3)","适用平方差模式。","组块"],
      ["math-equation","解一元一次方程","x+7=12，等式两侧同时减去 7。","x+7=12，x 等于多少？","5","移项需要保持等式相等。","图解"]
    ],
    "science-water":[
      ["water-precip","云中的水回到地表","云中的水滴或冰晶增长后可形成雨雪等降水。","雨和雪从大气落向地面的过程统称什么？","降水","降水包括雨、雪等多种形式。","过程图"],
      ["water-phase","从固态到液态","冰受热熔化，状态从固态变为液态。","冰变成液态水的过程叫什么？","熔化","不要与蒸发混淆。","正反例"],
      ["water-cycle","循环中的水重新流动","降水到地表后，一部分水沿地表汇流进入河流。","沿地表向河流汇集流动的水一般称为什么？","地表径流","注意水还可能渗入地下或再次蒸发。","过程图"]
    ],
    "science-space":[
      ["space-moon","地球的天然卫星","月球绕地球运动，是地球的天然卫星。","地球的天然卫星叫什么？","月球","卫星与恒星是不同类别。","关系图"],
      ["space-year","一年对应的公转","地球绕太阳公转一圈约需一年。","地球绕太阳公转一圈大约需要多久？","一年","这里是近似周期，不是精确到秒的天文数值。","关系图"],
      ["space-seasons","四季成因","地轴倾斜与地球公转，使不同季节太阳照射角度和日照时长变化。","地球四季变化与地轴倾斜及哪一种运动共同有关？","公转","不能简单说是地球离太阳远近造成四季。","正反例"]
    ],
    "science-bio":[
      ["bio-plants","植物如何制造有机物","绿色植物通过光合作用利用光能，将水和二氧化碳转化成有机物。","绿色植物利用光能制造有机物的过程叫什么？","光合作用","这是对光合作用的简化描述。","关系图"],
      ["bio-producer","食物网中的生产者","绿色植物通常是生态系统中的初级生产者。","草→兔→狐狸中，草属于生产者还是消费者？","生产者","生产者通常通过光合作用固定能量。","正反例"],
      ["bio-decomposer","分解者的作用","真菌和某些细菌可分解有机残体，让物质回到环境。","分解有机残体的生物在生态系统中通常叫什么？","分解者","分解作用参与物质循环。","关系图"]
    ],
    "history-dynasties":[
      ["his-wudai","唐宋之间的历史阶段","唐灭亡后经历五代十国的分裂割据阶段，随后进入宋代。","唐朝和宋朝之间通常说的历史阶段是什么？","五代十国","这是一种概括性时间划分。","时间线"],
      ["his-xinhai","辛亥革命的年份","辛亥革命于 1911 年爆发。","辛亥革命爆发于哪一年？","1911","年份需逐位准确回忆。","组块"],
      ["his-qin-text","秦朝统一文字","秦朝统一文字时推行以小篆为规范的书写体系。","秦朝统一文字时推行的规范字体主要是什么？","小篆","历史书写实践还涉及隶书的发展。","语义关联"]
    ],
    "geo-earth":[
      ["geo-first-meridian","经度零度线","通过英国格林尼治的本初子午线定义为零度经线。","经度 0° 的经线叫什么？","本初子午线","经线是连接南北两极的半圆线。","地图"],
      ["geo-latitude","纬度的起点","赤道是 0° 纬线，纬度向南北逐渐增大。","北极点的纬度是多少度？","90°N","北纬最高为 90°。","地图"],
      ["geo-orientation","看地图的经纬方向","一般经线连接南北极，纬线与赤道平行。","通常连接南极和北极的线叫经线还是纬线？","经线","避免将经纬线方向混淆。","画面"]
    ],
    "code-web":[
      ["code-css-class","CSS 类选择器","CSS 中以点号开头的选择器用于选择指定 class 的元素。","CSS 中选择类名 card 常写作什么？",".card","点号是 CSS 类选择器的一部分。","代码对照"],
      ["code-query","寻找第一个匹配元素","document.querySelector 根据 CSS 选择器返回第一个匹配元素。","JavaScript 中常用什么 DOM 方法找到第一个匹配元素？","querySelector","未匹配时返回 null。","代码对照"],
      ["code-let","JavaScript 块级作用域","使用 let 声明的变量具有块级作用域。","JavaScript 中常用哪个关键字声明可重新赋值的块级变量？","let","let 与 var 作用域不同。","正反例"]
    ],
    "code-git":[
      ["git-add","把改动放入暂存区","git add 选择下一次提交需要包含的变更。","将文件加入 Git 暂存区的常用命令是什么？","git add","仍需指定路径，例如 git add README.md。","真实操作"],
      ["git-commit","提交本地变更","git commit -m 后面跟提交说明。","包含提交说明的 Git 命令常以什么参数指定消息？","-m","-m 表示 message 参数。","真实操作"],
      ["git-log","查看提交历史","git log 查看当前仓库的历史提交。","查看 Git 提交历史的常用命令是什么？","git log","可添加参数控制输出。","真实操作"]
    ],
    "work-method":[
      ["work-plan","PDCA 的 P","PDCA 的 P 是 Plan，先做计划。","PDCA 中 P 的英文单词是什么？","Plan","先清楚目标和计划，再执行。","组块"],
      ["work-smart","SMART 目标的 S","SMART 是目标设定的一组常见原则，S 为 Specific。","SMART 原则中 S 通常代表哪个英文单词？","Specific","具体明确比模糊愿望更容易执行。","语义关联"],
      ["work-check","PDCA 的检查阶段","执行之后需要通过 Check 核查实际结果。","PDCA 中 Do 后面的阶段是什么？","Check","检查不等于凭空宣称已经完成目标。","流程图"]
    ],
    "life-check":[
      ["life-sequence","出门前的示例流程","示例流程：关窗→关灯→锁门；真实生活可自定义。","示例流程中，关窗后做什么？","关灯","不要把示例清单当个人实际安全要求。","组块"],
      ["life-group","随身物品分类","示例：钥匙是出入物品，手机是通信物品，水杯是饮水物品。","示例中负责通信的物品是什么？","手机","用功能类别帮助分组记忆。","语义关联"],
      ["life-kitchen","厨房整理三步骤","示例：收拾食材→清洁台面→检查水龙头。","示例流程中清洁台面之后检查什么？","水龙头","仅供顺序练习，不替代实际居家安全检查。","分镜"]
    ],
    "memory-digits":[
      ["mem-double-zero","两个零也不能消失","004572 分成 00 / 45 / 72，首两位零需要保留。","写出刚才记忆的完整六位数码（必须保留前导零）。","004572","即使语义等同，数字串的逐位回忆也不能漏零。","组块"],
      ["mem-pairs","数字分组再还原","208316 分为 20 / 83 / 16，恢复时不加空格。","按刚才的分组顺序，写出完整六位数码。","208316","需要和原来一模一样。","组块"],
      ["mem-reverse","数字倒序练习","依次读 17、42、09，再尝试从右到左写出各组。","把刚才的三组数字按“组”逆序排列，写成连续六位数码。","094217","倒序的是组顺序，组内数字顺序保持不变。","组块"]
    ],
    "memory-tools":[
      ["mem-five","手指桩的默认容量","五根手指作为固定记忆桩，适用于不超过五项的简短清单。","五指记忆法默认有多少个位置？","5","更多项目应换路线或分组，不硬塞同一个手指。","手指"],
      ["mem-pao","PAO 的六位组合","PAO 通常让人物、动作和物品分别对应两位编码，共六位。","标准三组两位数的 PAO 场景共包含几位数字？","6","须先建立稳定且可逆的编码表。","组块"],
      ["mem-interval","复习要跨时间","今天能答对不等于几天后仍能回忆，适当间隔再测。","跨天重新不看提示回答叫哪类练习？","间隔复习","持续保持需用真实复测验证。","正反例"]
    ],
    "logic-basics":[
      ["logic-ponens","肯定前件","如果 P 则 Q；已知 P，可以推断 Q。","如果 P 则 Q，而且 P 为真，能推出什么？","Q","这是肯定前件的有效推理。","图解"],
      ["logic-deny","否定后件","如果 P 则 Q；若 Q 为假，则 P 也不能为真。","如果 P 则 Q，而且非 Q，能推出什么？","非P","这是有效的否定后件推理。","正反例"],
      ["logic-affirm","肯定后件谬误","从如果 P 则 Q、又已知 Q，不能必然推出 P。","如果 P 则 Q，已知 Q，是否一定能推出 P？","不能","因为 Q 可能由别的条件造成。","正反例"]
    ],
    "econ-basics":[
      ["econ-marginal","边际成本是什么","边际成本是多生产一个单位产品带来的额外成本。","多生产一个单位所增加的成本叫什么？","边际成本","并非平均成本。","正反例"],
      ["econ-budget","收支差额","简单记账：收入减支出得到期间收支结余。","收入 100 元、支出 70 元，结余是多少元？","30","100 - 70 = 30 元。","组块"],
      ["econ-scarcity","经济学关注的稀缺性","资源有限而人们的需求可能超过资源所能满足的范围。","资源有限、无法满足全部需求的特征叫什么？","稀缺性","经济决策需要考虑选择与取舍。","语义关联"]
    ],
    "ai-literacy":[
      ["ai-factcheck","流畅不等于事实","生成式 AI 可能生成看似合理却不真实的内容，重要陈述应独立核对。","对于无法核实的 AI 陈述，最稳妥的下一步是什么？","核实来源","不要将语气自信当作证据。","正反例"],
      ["ai-context","提示词里写清约束","任务、背景与输出要求写清楚，能减少沟通歧义。","在提示词中说明目标、背景和什么内容有助于约束输出？","要求","可以用格式、范围、受众等具体要求。","组块"],
      ["ai-sources","核查涉及日期的信息","时效性事实需要核对可靠、更新日期明确的来源。","核查时效性事实时，除了来源可信度，还应关注什么？","日期","来源日期和事实发生时间可能不同。","真实操作"]
    ],
    "art-color":[
      ["art-rgb","RGB 光的三原色","显示器常用红、绿、蓝三色光叠加形成其他颜色。","RGB 中的 B 代表哪种颜色？","蓝色","RGB 是光色模型。","画面"],
      ["art-yellow","红光与绿光混合","在加色光混合模型中，红光与绿光叠加可得到黄色光。","加色光混合中红光加绿光通常得到什么颜色？","黄色","不要和颜料减色混合规则混淆。","图解"],
      ["art-lines","五线谱有几条线","标准五线谱由五条平行横线组成。","五线谱的基础横线有几条？","5","线与线之间形成四个间。","组块"]
    ],
    "finance-basics":[
      ["fin-income","收入减支出","收支结余等于收入减去期间支出。","本月收入 5000 元、支出 4200 元，结余多少元？","800","不包含未记录的其他现金流。","组块"],
      ["fin-interest","利滚利的含义","复利指后续计息时将已经计入本金的利息也纳入计算。","利息也参与后续计息叫什么？","复利","复利有不同计算频率，不保证投资收益。","语义关联"],
      ["fin-emergency","应急储备金","应急储备帮助应对突发支出和收入中断。","为应对突发支出而预留的资金通常称什么？","应急储备金","这里只介绍概念，不提供个人化投资建议。","正反例"]
    ],
    "study-strategies":[
      ["study-recall","主动回忆","在不查看参考答案时，从记忆中独立检索信息。","先合上答案再自己作答的练习叫做什么？","主动回忆","正确率不能在未测时凭空标记。","正反例"],
      ["study-interleave","交错练习","将相关但不同类型的题目交替练习，可帮助识别适用规则。","在不同类型题目之间交替练习通常叫什么？","交错练习","实际效果取决于学习阶段和材料。","组块"],
      ["study-feedback","先答后核","先独立作答，再用可靠答案核对并标记错误原因。","主动回忆之后应该用什么来核对结果？","参考答案","更重要的是针对错误改进。","真实操作"]
    ]
  };
  const chapters={};
  function addChapter(topicId,chapter){
    (chapters[topicId]||=[]).push(chapter);
  }
  function inheritBase(topic){
    return C.LESSONS.find(x=>x.subject===topic.subject)||C.LESSONS[0];
  }
  Object.keys(cases).forEach(topicId=>{
    const topic=C.topicsById[topicId];
    if(!topic)throw Error("Unknown topic "+topicId);
    const old=C.LESSONS.filter(x=>x.topicId===topicId).map(x=>x.id);
    const entries=cases[topicId];
    entries.forEach((r,index)=>{
      const base=inheritBase(topic),method=r[6];
      C.LESSONS.push(Object.assign({},base,{
        id:r[0],topicId,topic:topic.title,subject:topic.subject,icon:topic.icon,tone:topic.tone,
        title:r[1],cue:r[2],question:r[3],answer:r[4],explanation:r[5],method,
        minutes:3+(index===1?1:0),duration:index===1?"4–6 分钟":"3 分钟内",
        grade:topic.grade,goal:topic.goal,skill:topic.skill,theme:topic.theme,
        knowledge:topic.knowledge,exam:topic.exam,scenario:topic.scenario,
        tags:topic.tags.slice(),difficulty:index===2?"进阶":index===1?"巩固":"入门",
        format:method==="分镜"?"分镜卡":"互动学习卡",material:"原创教学示例",
        cognitive:topic.goal,recall:/^mem-/.test(r[0])?"精确数字":"文字填空",
        source:"原创教学示例",creator:"Memory Duet 编辑示例",order:"按题目要求"
      }));
    });
    addChapter(topicId,{id:topicId+"-discover",title:"01 · 先认识",intro:"从已有知识出发，理解这一专题的核心概念。",lessonIds:old.slice(0,2).concat([entries[0][0]])});
    addChapter(topicId,{id:topicId+"-contrast",title:"02 · 学会分辨",intro:"换一个角度或情境，辨认容易混淆的地方。",lessonIds:[entries[1][0]]});
    addChapter(topicId,{id:topicId+"-practice",title:"03 · 独立回忆",intro:"收起辅助线索，独立回答并核对内容。",lessonIds:[entries[2][0]]});
  });
  // Ensure legacy topics without new modules are still navigable.
  C.TOPICS.forEach(topic=>{
    if(chapters[topic.id])return;
    const ids=C.LESSONS.filter(x=>x.topicId===topic.id).map(x=>x.id);
    addChapter(topic.id,{id:topic.id+"-core",title:"01 · 专题基础",intro:"从入门示例开始尝试独立回忆。",lessonIds:ids});
  });
  C.TOPIC_CHAPTERS=chapters;
  C.getTopicChapters=topicId=>chapters[topicId]||[];
  C.getTopicLessons=topicId=>C.LESSONS.filter(x=>x.topicId===topicId);
  C.topicLessonCount=topicId=>C.getTopicLessons(topicId).length;

  // AND between dimensions, OR between values of the same dimension.
  // Preserve the existing single-facet API for backward compatibility.
  C.filterLessonsMulti=function(lessons,options,state){
    options=options||{};state=state||{};
    const facets=options.facets||{};
    const needle=String(options.search||"").trim().toLowerCase();
    const filtered=lessons.filter(lesson=>{
      if(options.onlySaved && !state.saved?.[lesson.id])return false;
      for(const key of Object.keys(facets)){
        const selected=Array.isArray(facets[key])?facets[key]:[facets[key]];
        if(!selected.length||selected.includes("全部"))continue;
        const value=C.facetValue(lesson,key,state);
        const choices=Array.isArray(value)?value:[value];
        if(!selected.some(s=>choices.includes(s)))return false;
      }
      return !needle||[lesson.title,lesson.subject,lesson.topic,lesson.cue,lesson.question,lesson.answer]
        .concat(lesson.tags||[]).join(" ").toLowerCase().includes(needle);
    });
    if(options.sort==="title")filtered.sort((a,b)=>a.title.localeCompare(b.title,"zh-CN"));
    if(options.sort==="short")filtered.sort((a,b)=>a.minutes-b.minutes);
    return filtered;
  };
  C.facetCountMap=function(lessons,key,options,state){
    const facets=Object.assign({},options&&options.facets||{});
    delete facets[key];
    const source=C.filterLessonsMulti(lessons,Object.assign({},options,{facets}),state);
    const counts={};
    source.forEach(lesson=>{
      const val=C.facetValue(lesson,key,state);
      (Array.isArray(val)?val:[val]).forEach(x=>{counts[x]=(counts[x]||0)+1;});
    });
    return counts;
  };
  return C;
});