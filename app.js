/* =====================================================
   每日饮食记录与评价建议 - MVP（纯前端，localStorage 存储）
   模块顺序：
   1 常量 → 2 食物营养表 → 3 工具函数 → 4 自然语言解析
   5 营养聚合 → 6 目标计算(BMR/TDEE) → 7 评分规则(可调配置)
   8 建议生成 → 9 状态与存储 → 10 渲染 → 11 事件处理 → 12 初始化
   ===================================================== */
'use strict';

/* ---------------- 1. 基础常量 ---------------- */
const MEALS = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
const UNITS = ['份', '碗', '杯', '个', '片', '盘', '根', '块', '勺', '包', '盒', '瓶', '罐', '听', '条', '只', '串', '球', '克', '毫升'];
const ALLERGEN_LIST = ['牛奶', '鸡蛋', '花生', '坚果', '大豆', '小麦(麸质)', '鱼', '虾/贝类'];
const STORE_KEY = 'diet-mvp-v1';

const DISCLAIMER_SHORT = '本应用仅作饮食记录与一般性营养科普，所有数值均为估算，不构成医疗诊断、治疗或个体化营养处方。';
const DISCLAIMER_FULL = DISCLAIMER_SHORT + '孕期、哺乳期，糖尿病、肾病、心血管疾病等慢性病，儿童青少年、老年人，进食障碍或正在服用特殊药物者，请咨询医生或注册营养师后再调整饮食。有食物过敏者请仔细核对实际食材与配料表，本应用的过敏原提醒不能保证完全安全。';

/* ---------------- 2. 食物营养表 ----------------
   per100：每 100 克（液体为 100 毫升）的营养估算值
   sodium 单位 mg；units：常见单位 → 克数换算；def：默认单位
   flags.whole = 全谷/粗粮；flags.addedSugar = 含添加糖；cat 用于多样性统计 */
function F(name, cat, per100, units, def, extra) {
  const base = { name, cat, per100, units, def, aliases: [], allergens: [], flags: {} };
  return Object.assign(base, extra || {});
}
const FOOD_DB = [
  // 主食
  F('米饭', '主食', { kcal: 116, protein: 2.6, carb: 25.9, fat: 0.3, fiber: 0.3, sodium: 2, sugar: 0 }, { '碗': 200, '份': 200, '盒': 250 }, '碗', { aliases: ['白米饭'] }),
  F('杂粮饭', '全谷主食', { kcal: 130, protein: 3.5, carb: 27, fat: 0.7, fiber: 2.5, sodium: 3, sugar: 0 }, { '碗': 200, '份': 200 }, '碗', { flags: { whole: true }, aliases: ['糙米饭', '杂粮粥'] }),
  F('粥', '主食', { kcal: 46, protein: 1.1, carb: 9.9, fat: 0.3, fiber: 0.1, sodium: 2, sugar: 0.9 }, { '碗': 250, '份': 250 }, '碗', { aliases: ['白粥', '稀饭'] }),
  F('面条', '主食', { kcal: 110, protein: 3.6, carb: 22, fat: 0.4, fiber: 1.8, sodium: 85, sugar: 0.6 }, { '碗': 300, '份': 300 }, '碗', { aliases: ['汤面', '拉面', '挂面', '面'], allergens: ['小麦(麸质)'] }),
  F('牛肉面', '主食', { kcal: 96, protein: 4, carb: 12, fat: 3, fiber: 0.4, sodium: 240, sugar: 0.6 }, { '碗': 500, '份': 500 }, '碗', { aliases: ['红烧牛肉面'], allergens: ['小麦(麸质)'] }),
  F('馒头', '主食', { kcal: 223, protein: 7, carb: 47, fat: 1.1, fiber: 1.5, sodium: 165, sugar: 1 }, { '个': 100, '份': 100 }, '个', { aliases: ['白馒头'], allergens: ['小麦(麸质)'] }),
  F('炒饭', '主食', { kcal: 180, protein: 5.5, carb: 25, fat: 6.5, fiber: 0.8, sodium: 420, sugar: 1 }, { '份': 300, '碗': 300 }, '份', {}),
  F('饺子', '主食', { kcal: 220, protein: 8, carb: 25, fat: 8, fiber: 1.5, sodium: 450, sugar: 1 }, { '个': 25, '份': 250 }, '个', { aliases: ['水饺'], allergens: ['小麦(麸质)'] }),
  F('包子', '主食', { kcal: 230, protein: 7.5, carb: 34, fat: 7, fiber: 1.2, sodium: 400, sugar: 2 }, { '个': 80, '份': 160 }, '个', { aliases: ['肉包', '菜包'], allergens: ['小麦(麸质)'] }),
  F('汉堡', '主食', { kcal: 250, protein: 13, carb: 26, fat: 11, fiber: 1.5, sodium: 500, sugar: 5 }, { '个': 200, '份': 200 }, '个', { allergens: ['小麦(麸质)'] }),
  F('披萨', '主食', { kcal: 260, protein: 11, carb: 30, fat: 10, fiber: 2, sodium: 600, sugar: 3 }, { '块': 110, '份': 400 }, '块', { allergens: ['小麦(麸质)', '牛奶'] }),
  // 全谷 / 粗粮
  F('全麦面包', '全谷主食', { kcal: 250, protein: 9, carb: 45, fat: 3.5, fiber: 6, sodium: 420, sugar: 4 }, { '片': 35, '份': 70 }, '片', { flags: { whole: true }, aliases: ['全麦吐司', '全麦土司'], allergens: ['小麦(麸质)'] }),
  F('燕麦片', '全谷主食', { kcal: 370, protein: 15, carb: 60, fat: 7, fiber: 10, sodium: 5, sugar: 1 }, { '份': 40, '勺': 25 }, '份', { flags: { whole: true }, aliases: ['燕麦', '麦片'] }),
  F('燕麦粥', '全谷主食', { kcal: 62, protein: 2.5, carb: 10.5, fat: 1.3, fiber: 1.6, sodium: 3, sugar: 0.5 }, { '碗': 250 }, '碗', { flags: { whole: true } }),
  F('玉米', '全谷主食', { kcal: 112, protein: 4, carb: 22.8, fat: 1.2, fiber: 2.9, sodium: 1, sugar: 6 }, { '根': 200, '份': 150 }, '根', { flags: { whole: true } }),
  F('红薯', '全谷主食', { kcal: 90, protein: 2, carb: 21, fat: 0.2, fiber: 3, sodium: 28, sugar: 6 }, { '个': 200, '份': 150 }, '个', { flags: { whole: true }, aliases: ['地瓜', '番薯'] }),
  F('土豆', '主食', { kcal: 77, protein: 2, carb: 17, fat: 0.1, fiber: 1.2, sodium: 3, sugar: 0.8 }, { '个': 150, '份': 150 }, '个', { aliases: ['马铃薯'] }),
  // 肉禽水产蛋
  F('鸡胸肉', '肉禽', { kcal: 165, protein: 31, carb: 0, fat: 3.6, fiber: 0, sodium: 74, sugar: 0 }, { '份': 100, '块': 100 }, '份', { aliases: ['鸡胸'] }),
  F('鸡腿', '肉禽', { kcal: 180, protein: 25, carb: 0, fat: 9, fiber: 0, sodium: 90, sugar: 0 }, { '个': 120, '份': 120 }, '个', { aliases: ['鸡肉'] }),
  F('牛肉', '肉禽', { kcal: 250, protein: 26, carb: 0, fat: 15, fiber: 0, sodium: 60, sugar: 0 }, { '份': 100 }, '份', { aliases: ['酱牛肉', '肥牛'] }),
  F('猪肉', '肉禽', { kcal: 195, protein: 27, carb: 0, fat: 9, fiber: 0, sodium: 60, sugar: 0 }, { '份': 100 }, '份', { aliases: ['瘦肉', '猪里脊'] }),
  F('排骨', '肉禽', { kcal: 280, protein: 18, carb: 0, fat: 22, fiber: 0, sodium: 70, sugar: 0 }, { '份': 100, '块': 40 }, '份', {}),
  F('培根', '肉禽', { kcal: 500, protein: 25, carb: 1, fat: 42, fiber: 0, sodium: 1500, sugar: 0 }, { '片': 15, '份': 30 }, '片', {}),
  F('鱼', '水产', { kcal: 150, protein: 20, carb: 0, fat: 7, fiber: 0, sodium: 60, sugar: 0 }, { '份': 100 }, '份', { aliases: ['鲈鱼', '三文鱼', '带鱼', '清蒸鱼'], allergens: ['鱼'] }),
  F('虾', '水产', { kcal: 100, protein: 19, carb: 1, fat: 1, fiber: 0, sodium: 170, sugar: 0 }, { '份': 100 }, '份', { aliases: ['虾仁', '基围虾', '白灼虾'], allergens: ['虾/贝类'] }),
  F('鸡蛋', '蛋类', { kcal: 144, protein: 13.3, carb: 2.8, fat: 8.8, fiber: 0, sodium: 130, sugar: 0 }, { '个': 50, '份': 100 }, '个', { aliases: ['蛋', '煮鸡蛋', '荷包蛋', '煎蛋', '炒蛋', '蒸蛋'], allergens: ['鸡蛋'] }),
  // 奶类豆类
  F('牛奶', '奶类', { kcal: 54, protein: 3, carb: 3.4, fat: 3.3, fiber: 0, sodium: 40, sugar: 5 }, { '杯': 250, '瓶': 250, '盒': 250, '毫升': 1, '克': 1 }, '杯', { aliases: ['纯牛奶', '鲜奶'], allergens: ['牛奶'] }),
  F('酸奶', '奶类', { kcal: 72, protein: 2.8, carb: 9.7, fat: 3.3, fiber: 0, sodium: 35, sugar: 9 }, { '杯': 200, '盒': 200, '瓶': 200 }, '杯', { flags: { addedSugar: true }, aliases: ['酸牛奶'], allergens: ['牛奶'] }),
  F('奶酪', '奶类', { kcal: 328, protein: 25, carb: 2, fat: 26, fiber: 0, sodium: 600, sugar: 1 }, { '片': 20, '份': 20 }, '片', { aliases: ['芝士', '干酪'], allergens: ['牛奶'] }),
  F('豆腐', '豆类', { kcal: 82, protein: 8, carb: 4.8, fat: 5, fiber: 0.4, sodium: 7, sugar: 0 }, { '份': 100, '块': 100 }, '份', { allergens: ['大豆'] }),
  F('豆浆', '豆类', { kcal: 31, protein: 3, carb: 1.2, fat: 1.6, fiber: 0.1, sodium: 3, sugar: 1 }, { '杯': 250 }, '杯', { aliases: ['豆奶'], allergens: ['大豆'] }),
  // 蔬菜
  F('西兰花', '深色蔬菜', { kcal: 34, protein: 2.8, carb: 6.6, fat: 0.4, fiber: 2.6, sodium: 18, sugar: 1.7 }, { '份': 100, '盘': 300 }, '份', { aliases: ['花椰菜', '绿花菜'] }),
  F('菠菜', '深色蔬菜', { kcal: 24, protein: 2.6, carb: 3.6, fat: 0.3, fiber: 1.7, sodium: 85, sugar: 0.4 }, { '份': 100, '盘': 250 }, '份', {}),
  F('青菜', '深色蔬菜', { kcal: 16, protein: 1.5, carb: 2.4, fat: 0.3, fiber: 1.1, sodium: 55, sugar: 0.4 }, { '份': 100, '盘': 250 }, '份', { aliases: ['小白菜', '油菜', '绿叶菜', '油麦菜'] }),
  F('胡萝卜', '深色蔬菜', { kcal: 39, protein: 1, carb: 8.8, fat: 0.2, fiber: 2.7, sodium: 70, sugar: 5 }, { '根': 120, '份': 100 }, '根', {}),
  F('番茄', '蔬菜', { kcal: 18, protein: 0.9, carb: 3.9, fat: 0.2, fiber: 0.5, sodium: 5, sugar: 2.6 }, { '个': 150, '份': 100 }, '个', { aliases: ['西红柿'] }),
  F('黄瓜', '蔬菜', { kcal: 15, protein: 0.7, carb: 2.9, fat: 0.2, fiber: 0.5, sodium: 5, sugar: 1.7 }, { '根': 200, '份': 100 }, '根', {}),
  F('生菜', '蔬菜', { kcal: 13, protein: 1.3, carb: 2, fat: 0.2, fiber: 0.7, sodium: 33, sugar: 0.8 }, { '份': 100, '盘': 200 }, '份', {}),
  F('沙拉', '蔬菜', { kcal: 90, protein: 1.5, carb: 6, fat: 6, fiber: 1.5, sodium: 150, sugar: 3 }, { '份': 200 }, '份', { aliases: ['蔬菜沙拉'] }),
  // 水果
  F('苹果', '水果', { kcal: 52, protein: 0.3, carb: 13.8, fat: 0.2, fiber: 2.4, sodium: 2, sugar: 10 }, { '个': 200, '份': 150 }, '个', {}),
  F('香蕉', '水果', { kcal: 93, protein: 1.1, carb: 22, fat: 0.3, fiber: 2.6, sodium: 1, sugar: 12 }, { '根': 120, '个': 120 }, '根', {}),
  F('橙子', '水果', { kcal: 47, protein: 0.9, carb: 11.8, fat: 0.1, fiber: 2.4, sodium: 2, sugar: 9 }, { '个': 180, '份': 150 }, '个', { aliases: ['橙', '橘子'] }),
  F('葡萄', '水果', { kcal: 69, protein: 0.5, carb: 16, fat: 0.3, fiber: 0.4, sodium: 2, sugar: 15 }, { '份': 150 }, '份', {}),
  F('西瓜', '水果', { kcal: 31, protein: 0.6, carb: 6, fat: 0.2, fiber: 0.3, sodium: 3, sugar: 6 }, { '块': 300, '份': 200 }, '块', {}),
  F('猕猴桃', '水果', { kcal: 56, protein: 0.8, carb: 14, fat: 0.5, fiber: 3, sodium: 3, sugar: 9 }, { '个': 100 }, '个', { aliases: ['奇异果'] }),
  F('草莓', '水果', { kcal: 30, protein: 1, carb: 7, fat: 0.3, fiber: 1.6, sodium: 2, sugar: 5 }, { '份': 150 }, '份', {}),
  // 坚果
  F('坚果', '坚果', { kcal: 600, protein: 20, carb: 20, fat: 52, fiber: 9, sodium: 20, sugar: 5 }, { '份': 25, '把': 25 }, '份', { aliases: ['混合坚果', '核桃', '杏仁', '腰果'], allergens: ['坚果'] }),
  F('花生', '坚果', { kcal: 570, protein: 25, carb: 20, fat: 46, fiber: 8, sodium: 10, sugar: 4 }, { '份': 25, '把': 25 }, '份', { allergens: ['花生', '坚果'] }),
  // 饮品
  F('奶茶', '含糖饮品', { kcal: 75, protein: 1.5, carb: 12, fat: 3, fiber: 0, sodium: 30, sugar: 8 }, { '杯': 500, '瓶': 500 }, '杯', { flags: { addedSugar: true }, aliases: ['珍珠奶茶', '波霸奶茶'], allergens: ['牛奶'] }),
  F('可乐', '含糖饮品', { kcal: 43, protein: 0, carb: 10.6, fat: 0, fiber: 0, sodium: 5, sugar: 10.6 }, { '罐': 330, '瓶': 500, '杯': 330 }, '罐', { flags: { addedSugar: true }, aliases: ['可口可乐', '百事可乐', '雪碧'] }),
  F('果汁', '含糖饮品', { kcal: 45, protein: 0.4, carb: 10.5, fat: 0.2, fiber: 0.2, sodium: 5, sugar: 10 }, { '杯': 250 }, '杯', { flags: { addedSugar: true }, aliases: ['橙汁', '苹果汁'] }),
  F('拿铁', '饮品', { kcal: 43, protein: 2.3, carb: 4, fat: 1.7, fiber: 0, sodium: 25, sugar: 4 }, { '杯': 350 }, '杯', { aliases: ['咖啡拿铁', '咖啡'], allergens: ['牛奶'] }),
  F('美式咖啡', '饮品', { kcal: 5, protein: 0.2, carb: 0.8, fat: 0, fiber: 0, sodium: 3, sugar: 0 }, { '杯': 350 }, '杯', { aliases: ['美式', '黑咖啡'] }),
  F('茶', '饮品', { kcal: 1, protein: 0, carb: 0.2, fat: 0, fiber: 0, sodium: 1, sugar: 0 }, { '杯': 350 }, '杯', { aliases: ['绿茶', '红茶', '乌龙茶', '无糖茶'] }),
  F('啤酒', '饮品', { kcal: 43, protein: 0.5, carb: 3.6, fat: 0, fiber: 0, sodium: 5, sugar: 0 }, { '瓶': 500, '罐': 330 }, '瓶', {}),
  // 甜点零食
  F('蛋糕', '甜点', { kcal: 320, protein: 5, carb: 45, fat: 13, fiber: 1, sodium: 200, sugar: 30 }, { '块': 100, '份': 100 }, '块', { flags: { addedSugar: true }, allergens: ['鸡蛋', '牛奶', '小麦(麸质)'] }),
  F('冰淇淋', '甜点', { kcal: 200, protein: 3.5, carb: 28, fat: 8, fiber: 0, sodium: 80, sugar: 25 }, { '球': 60, '份': 100 }, '球', { flags: { addedSugar: true }, aliases: ['雪糕', '冰激凌'], allergens: ['牛奶'] }),
  F('巧克力', '甜点', { kcal: 550, protein: 5, carb: 60, fat: 32, fiber: 3, sodium: 50, sugar: 50 }, { '块': 15, '份': 30 }, '块', { flags: { addedSugar: true } }),
  F('饼干', '甜点', { kcal: 450, protein: 7, carb: 70, fat: 15, fiber: 2, sodium: 300, sugar: 20 }, { '包': 50, '片': 10, '份': 30 }, '包', { flags: { addedSugar: true }, allergens: ['小麦(麸质)'] }),
  F('薯条', '油炸零食', { kcal: 300, protein: 3.4, carb: 41, fat: 15, fiber: 3.8, sodium: 210, sugar: 0.3 }, { '份': 110 }, '份', {}),
  F('薯片', '油炸零食', { kcal: 550, protein: 6, carb: 50, fat: 35, fiber: 4, sodium: 500, sugar: 1 }, { '包': 70, '份': 50 }, '包', {}),
  F('油条', '油炸零食', { kcal: 390, protein: 6.9, carb: 51, fat: 17, fiber: 1.5, sodium: 580, sugar: 1 }, { '根': 60 }, '根', { allergens: ['小麦(麸质)'] }),
];

/* ---------------- 3. 工具函数 ---------------- */
function esc(s) { // HTML 转义，防止用户输入破坏页面
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
function round1(x) { return Math.round(x * 10) / 10; }
function todayStr() { return fmtDate(new Date()); }
function fmtDate(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}
function nextDateStr(dateStr) {
  const t = new Date(dateStr + 'T12:00:00'); t.setDate(t.getDate() + 1); return fmtDate(t);
}
function weekdayLabel(dateStr) {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(dateStr + 'T12:00:00').getDay()];
}
function uid() { return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function parseCnNum(s) { // 中文数字 / 阿拉伯数字 → 数值
  if (!s) return null;
  s = s.trim();
  if (s === '半') return 0.5;
  if (/^[\d.]+$/.test(s)) return parseFloat(s);
  const map = { '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
  if (s.length === 1 && map[s]) return map[s];
  const m = s.match(/^([一二两三四五六七八九])?十([一二三四五六七八九])?$/);
  if (m) { let t = m[1] ? map[m[1]] * 10 : 10; if (m[2]) t += map[m[2]]; return t; }
  return null;
}
// 步进式打分：points 为升序 [阈值, 分数]，低于首阈值取首分数
function stepScore(x, points) {
  for (const [th, sc] of points) { if (x <= th) return sc; }
  return points[points.length - 1][1];
}

/* ---------------- 4. 自然语言解析 ---------------- */
// 餐次关键词（按顺序匹配，避免"下午"被当成"午餐"）
const MEAL_PATTERNS = [
  { re: /(早餐|早饭|早晨|早上)/, meal: 'breakfast' },
  { re: /(中午|午餐|午饭)/, meal: 'lunch' },
  { re: /(下午|午后|加餐|零食|夜宵)/, meal: 'snack' },
  { re: /(晚上|晚餐|晚饭)/, meal: 'dinner' },
];

// 文本 → [{name, qty, unit, meal, noSugar}]
function localParse(text) {
  const out = [];
  let currentMeal = null;
  const chunks = String(text || '').split(/[。；;！!？?\n]+/);
  for (let chunk of chunks) {
    chunk = chunk.trim();
    if (!chunk) continue;
    // 识别并移除餐次关键词
    let meal = null;
    for (const p of MEAL_PATTERNS) {
      if (p.re.test(chunk)) { meal = p.meal; chunk = chunk.replace(p.re, ''); break; }
    }
    if (meal) currentMeal = meal;
    const mealForItems = currentMeal || 'lunch'; // 未指定时沿用上一句，默认午餐
    // 按顿号/逗号拆分食物项
    const parts = chunk.split(/[，,、]+/);
    for (let part of parts) {
      part = part.trim().replace(/^(吃了?|喝了?|来点?|来了?|要了?|然后|还有|另外)/, '').trim();
      if (!part) continue;
      const parsed = parseOneItem(part);
      if (parsed) { parsed.meal = parsed.meal || mealForItems; out.push(parsed); }
    }
  }
  return out;
}

// 单个食物短语解析，如 "两碗米饭" / "半盘西兰花" / "500毫升可乐"
function parseOneItem(text) {
  let noSugar = false;
  let t = text;
  if (/无糖|不加糖|零度|无蔗糖/.test(t)) { noSugar = true; t = t.replace(/无糖|不加糖|零度|无蔗糖/g, '').trim(); }
  let name = t, qty = 1, unit = '份', matched = false;
  const m = t.match(/^(半|[\d一二两三四五六七八九十]+(?:\.\d+)?)\s*(大|小)?\s*(碗|杯|个|片|份|盘|勺|块|根|只|条|罐|瓶|听|包|盒|颗|枚|串|球|克|毫升|升)?\s*(.+)$/);
  if (m) {
    const n = parseCnNum(m[1]);
    if (n != null && m[4]) {
      qty = n; matched = true;
      if (m[3] === '克' || m[3] === '毫升') { unit = m[3]; }
      else if (m[3]) { unit = m[3]; }
      else if (m[2]) { unit = '份'; } // 只有"大/小"没有量词
      else { unit = '份'; }
      name = m[4].trim();
    }
  }
  // "500ml" 这类写法
  const ml = t.match(/^([\d.]+)\s*(?:ml|ML|mL|毫升)$/);
  if (ml) { qty = parseFloat(ml[1]); unit = '毫升'; name = t.replace(/^([\d.]+)\s*(?:ml|ML|mL|毫升)/, '').trim() || name; matched = true; }
  if (!name) return null;
  return { name, qty, unit, noSugar, raw: text };
}

// 食物名匹配（最长匹配，含别名）
function matchFood(name) {
  const s = String(name || '').trim();
  if (!s) return null;
  let best = null, bestLen = 0;
  for (const f of FOOD_DB) {
    for (const al of [f.name, ...f.aliases]) {
      if (s.includes(al) && al.length > bestLen) { best = f; bestLen = al.length; }
    }
  }
  return best;
}

/* ---------------- 5. 创建食物条目 ---------------- */
function makeItem(parsed) {
  const item = {
    id: uid(), name: parsed.name, meal: parsed.meal, qty: parsed.qty, unit: parsed.unit,
    raw: parsed.raw || '', estimated: true, pending: false, note: '', allergens: [], flags: {}, food: null,
    kcal: 0, protein: 0, carb: 0, fat: 0, fiber: 0, sodium: 0, sugar: 0, grams: 0,
  };
  const food = matchFood(parsed.name);
  if (!food) {
    item.pending = true;
    item.note = '未识别的食物，请选择近似食物或手动填写营养';
    return item;
  }
  item.food = food.name;
  item.allergens = (food.allergens || []).slice();
  item.flags = Object.assign({}, food.flags);
  let grams;
  if (parsed.unit === '克' || parsed.unit === '毫升') grams = parsed.qty;
  else if (food.units[parsed.unit]) grams = parsed.qty * food.units[parsed.unit];
  else { grams = parsed.qty * food.units[food.def]; item.note = `单位"${parsed.unit}"按${food.def}估算`; }
  item.grams = Math.round(grams);
  const sc = grams / 100;
  item.kcal = Math.round(food.per100.kcal * sc);
  item.protein = round1(food.per100.protein * sc);
  item.carb = round1(food.per100.carb * sc);
  item.fat = round1(food.per100.fat * sc);
  item.fiber = round1(food.per100.fiber * sc);
  item.sodium = Math.round(food.per100.sodium * sc);
  item.sugar = round1(food.per100.sugar * sc);
  // "无糖" 变体处理
  if (parsed.noSugar) {
    if (food.name === '奶茶') { item.kcal = Math.round(item.kcal * 0.4); item.sugar = round1(item.sugar * 0.15); item.carb = round1(item.carb * 0.4); item.flags.addedSugar = false; item.note = '已按无糖奶茶估算'; }
    else if (food.name === '酸奶') { item.kcal = Math.round(item.kcal * 0.85); item.sugar = round1(item.sugar * 0.5); item.carb = round1(item.carb * 0.55); item.flags.addedSugar = false; item.note = '已按无糖酸奶估算'; }
    else if (food.name === '可乐') { item.kcal = Math.round(item.kcal * 0.02); item.sugar = 0; item.carb = round1(item.carb * 0.02); item.flags.addedSugar = false; item.note = '已按无糖可乐估算'; }
    else item.note = (item.note ? item.note + '；' : '') + '该食物暂无"无糖"版本数据，按常规估算';
  }
  return item;
}

/* ---------------- 6. 营养聚合 ---------------- */
function aggregateDay(log) {
  const agg = {
    kcal: 0, protein: 0, carb: 0, fat: 0, fiber: 0, sodium: 0, sugar: 0, addedSugar: 0,
    veg: 0, fruit: 0, staple: 0, whole: 0, grams: 0,
    cats: new Set(), meals: new Set(), allergenHits: [], pending: 0, count: 0, names: [],
  };
  if (!log) return agg;
  for (const mk of MEAL_ORDER) {
    for (const it of (log.meals[mk] || [])) {
      agg.count++;
      agg.meals.add(mk);
      agg.names.push(it.name);
      if (it.pending) { agg.pending++; continue; }
      agg.kcal += it.kcal; agg.protein += it.protein; agg.carb += it.carb;
      agg.fat += it.fat; agg.fiber += it.fiber; agg.sodium += it.sodium; agg.sugar += it.sugar;
      if (it.flags.addedSugar) agg.addedSugar += it.sugar;
      const food = matchFood(it.food || it.name);
      const cat = food ? food.cat : null;
      if (cat) agg.cats.add(cat);
      if (cat === '蔬菜' || cat === '深色蔬菜') agg.veg += it.grams;
      if (cat === '水果') agg.fruit += it.grams;
      if (cat === '主食' || cat === '全谷主食') agg.staple += it.grams;
      if (cat === '全谷主食' || (food && food.flags.whole)) agg.whole += it.grams;
      // 过敏原匹配（用户设置 × 食物）
      for (const a of (it.allergens || [])) {
        if ((state.profile.allergens || []).includes(a) && !agg.allergenHits.find(h => h.food === it.name && h.a === a)) {
          agg.allergenHits.push({ food: it.name, a });
        }
      }
    }
  }
  for (const k of ['kcal', 'protein', 'carb', 'fat', 'fiber', 'sodium', 'sugar', 'addedSugar', 'veg', 'fruit', 'staple', 'whole']) {
    agg[k] = round1(agg[k]);
  }
  agg.kcal = Math.round(agg.kcal);
  return agg;
}

/* ---------------- 7. 目标计算（简化公式，均为估算） ---------------- */
const NUTRITION_TARGETS = { fiber: 25, sodium: 2000, addedSugar: 25, veg: 300, fruit: 200 };
function getTargets(profile) {
  const w = profile.weight || 65, h = profile.height || 170, a = profile.age || 30;
  const female = profile.gender === 'female';
  const bmr = 10 * w + 6.25 * h - 5 * a + (female ? -161 : 5); // Mifflin-St Jeor 简化公式
  const act = { low: 1.2, light: 1.375, moderate: 1.55, high: 1.725 }[profile.activity || 'moderate'];
  const tdee = bmr * act;
  const goalAdj = { '减脂': -400, '维持': 0, '增肌': 250, '一般健康': 0 }[profile.goal || '一般健康'] || 0;
  const kcal = clamp(Math.round((tdee + goalAdj) / 10) * 10, 1200, 4000);
  return {
    bmr: Math.round(bmr), tdee: Math.round(tdee), kcal,
    protein: Math.round(w * 1.2), // 约 1.2 g/kg，可接受范围 1.0–1.6
    ...NUTRITION_TARGETS,
    fatMax: Math.round(kcal * 0.3 / 9),
  };
}

/* ---------------- 8. 评分规则（可读、可调整） ----------------
   每个维度返回 {score, reason, tip}，权重在 SCORING_RULES 中调整 */
const SCORING_RULES = {
  calorie:      { weight: 15, name: '热量适宜度' },
  protein:      { weight: 15, name: '蛋白质' },
  staple:       { weight: 10, name: '主食与碳水质量' },
  vegfruit:     { weight: 15, name: '蔬菜水果' },
  fiber:        { weight: 10, name: '膳食纤维' },
  oilSaltSugar: { weight: 15, name: '油盐糖控制' },
  diversity:    { weight: 10, name: '食物多样性' },
  regularity:   { weight: 10, name: '进餐规律' },
};

function evaluateDay(agg, targets) {
  const dims = {};
  const hasFood = agg.count > 0;

  // 8.1 热量适宜度：当日估算热量 vs 目标区间（±15%）
  if (!hasFood) {
    dims.calorie = { score: 0, reason: '今天还没有记录。' };
  } else {
    const r = agg.kcal / targets.kcal;
    let score, extra = '';
    if (r >= 0.9 && r <= 1.1) score = 95;
    else if (r >= 0.8 && r < 0.9) { score = 82; extra = '略低于目标区间'; }
    else if (r > 1.1 && r <= 1.25) { score = 82; extra = '略高于目标区间'; }
    else if (r >= 0.7 && r < 0.8) { score = 65; extra = '低于目标区间'; }
    else if (r > 1.25 && r <= 1.45) { score = 65; extra = '高于目标区间'; }
    else { score = 45; extra = r < 0.7 ? '明显低于目标' : '明显高于目标'; }
    dims.calorie = {
      score,
      reason: `估算摄入约 ${agg.kcal} kcal，目标约 ${targets.kcal} kcal（±15% 区间），${extra || '在合理范围内'}。`,
    };
  }

  // 8.2 蛋白质：估算摄入 vs 约 1.2 g/kg 目标
  if (!hasFood) {
    dims.protein = { score: 0, reason: '今天还没有记录。' };
  } else {
    const r = agg.protein / targets.protein;
    let score, extra;
    if (r > 2) { score = 75; extra = '摄入偏高，一般健康人群无需刻意堆量'; }
    else if (r >= 1) { score = 95; extra = '摄入充足'; }
    else if (r >= 0.8) { score = 85; extra = '接近目标'; }
    else if (r >= 0.6) { score = 70; extra = '略有不足'; }
    else if (r >= 0.4) { score = 50; extra = '不足'; }
    else { score = 30; extra = '明显不足'; }
    dims.protein = {
      score,
      reason: `估算蛋白质 ${agg.protein} g，目标约 ${targets.protein} g（按体重约 1.2 g/kg 估算），${extra}。`,
    };
  }

  // 8.3 主食与碳水质量：主食总量 + 全谷占比
  if (!hasFood) {
    dims.staple = { score: 0, reason: '今天还没有记录。' };
  } else if (agg.staple === 0) {
    dims.staple = { score: 40, reason: '未记录到主食类食物，碳水摄入可能偏低。' };
  } else {
    const wr = agg.whole / agg.staple;
    const score = clamp(Math.round(55 + wr * 90), 40, 100);
    dims.staple = {
      score,
      reason: `主食约 ${agg.staple} g，其中全谷/粗粮占约 ${Math.round(wr * 100)}%。` + (wr >= 0.3 ? '粗细搭配不错。' : '以精制主食为主。'),
    };
  }

  // 8.4 蔬菜水果：蔬菜目标 300g（权重 70）、水果目标 200g（权重 30）
  if (!hasFood) {
    dims.vegfruit = { score: 0, reason: '今天还没有记录。' };
  } else {
    const vs = clamp(agg.veg / targets.veg, 0, 1) * 70;
    const fs = clamp(agg.fruit / targets.fruit, 0, 1) * 30;
    const score = Math.round(vs + fs);
    let s = [];
    if (agg.veg < targets.veg * 0.5) s.push(`蔬菜约 ${agg.veg} g，偏少`);
    else s.push(`蔬菜约 ${agg.veg} g`);
    if (agg.fruit < targets.fruit * 0.5) s.push(`水果约 ${agg.fruit} g，偏少`);
    else s.push(`水果约 ${agg.fruit} g`);
    dims.vegfruit = { score, reason: s.join('；') + '。参考：每天蔬菜 300–500 g、水果 200–350 g。' };
  }

  // 8.5 膳食纤维：目标约 25 g
  if (!hasFood) {
    dims.fiber = { score: 0, reason: '今天还没有记录。' };
  } else {
    const r = agg.fiber / targets.fiber;
    const score = stepScore(r, [[0.4, 30], [0.6, 50], [0.8, 70], [1, 85], [Infinity, 95]]);
    dims.fiber = { score, reason: `估算膳食纤维约 ${agg.fiber} g，一般建议每天约 25 g。` };
  }

  // 8.6 油盐糖控制：钠 / 添加糖 / 脂肪供能比 三项平均
  if (!hasFood) {
    dims.oilSaltSugar = { score: 0, reason: '今天还没有记录。' };
  } else {
    const sodiumScore = stepScore(agg.sodium, [[1500, 95], [2000, 85], [3000, 70], [4000, 55], [Infinity, 40]]);
    const sugarScore = stepScore(agg.addedSugar, [[10, 95], [25, 85], [50, 70], [75, 55], [Infinity, 40]]);
    const fatRatio = agg.kcal > 0 ? (agg.fat * 9) / agg.kcal : 0.3;
    const fatScore = stepScore(fatRatio, [[0.25, 95], [0.3, 85], [0.35, 70], [0.4, 55], [Infinity, 40]]);
    const score = Math.round((sodiumScore + sugarScore + fatScore) / 3);
    dims.oilSaltSugar = {
      score,
      reason: `估算钠约 ${agg.sodium} mg（建议 <2000）、添加糖约 ${agg.addedSugar} g（建议 <25）、脂肪供能比约 ${Math.round(fatRatio * 100)}%（建议 <30%）。`,
      sub: { sodiumScore, sugarScore, fatScore },
    };
  }

  // 8.7 食物多样性：按食物类别数打分（类别定义见食物营养表）
  if (!hasFood) {
    dims.diversity = { score: 0, reason: '今天还没有记录。' };
  } else {
    const n = agg.cats.size;
    const score = stepScore(n, [[2, 20], [3, 32], [4, 45], [5, 58], [6, 70], [7, 80], [8, 88], [Infinity, 95]]);
    dims.diversity = { score, reason: `今天共涉及 ${n} 类食物（${[...agg.cats].join('、') || '无'}），类别越丰富，营养覆盖越全面。` };
  }

  // 8.8 进餐规律：早/午/晚餐是否记录
  if (!hasFood) {
    dims.regularity = { score: 0, reason: '今天还没有记录。' };
  } else {
    let score = 10;
    const parts = [];
    if (agg.meals.has('breakfast')) { score += 35; } else parts.push('未记录早餐');
    if (agg.meals.has('lunch')) { score += 25; } else parts.push('未记录午餐');
    if (agg.meals.has('dinner')) { score += 25; } else parts.push('未记录晚餐');
    if (agg.meals.size >= 3) { score += 15 - 10; } // 三餐齐 +5 保底，避免总和超 100
    score = clamp(score, 5, 100);
    dims.regularity = {
      score,
      reason: parts.length ? parts.join('、') + '。规律三餐有助于稳定血糖和食欲。' : '三餐记录齐全，节奏规律。',
    };
  }

  // 总分 = 加权平均（权重合计 100）
  let total = 0, wSum = 0;
  for (const k in SCORING_RULES) {
    total += (dims[k] ? dims[k].score : 0) * SCORING_RULES[k].weight;
    wSum += SCORING_RULES[k].weight;
  }
  return { total: hasFood ? Math.round(total / wSum) : null, dims, time: new Date().toISOString() };
}

/* ---------------- 9. 建议生成（按优先级，最多 5 条） ---------------- */
function buildSuggestions(agg, targets, dims) {
  const list = [];
  const add = (sev, title, why, how) => list.push({ sev, title, why, how });

  if (agg.count === 0) return list;

  if (agg.allergenHits.length) {
    const names = agg.allergenHits.map(h => `${h.food}（${h.a}）`).join('、');
    add(100, '注意过敏原', `记录中识别到与您设置的过敏原可能相关的食物：${names}。`,
      '请核对实际食材和配料表；本应用提醒不能保证安全，如有疑虑请避免食用并咨询医生。');
  }
  if (agg.pending > 0) {
    add(95, '有待确认的食物', `今天有 ${agg.pending} 项食物未能识别，营养估算不完整，评分可能偏差。`,
      '在今日记录中点击"待确认"的条目，改成近似食物，或手动填写热量和营养。');
  }
  if (dims.oilSaltSugar && dims.oilSaltSugar.sub.sodiumScore < 60) {
    add(80, '钠（盐）摄入偏高', `今天估算钠约 ${agg.sodium} mg，超过一般建议的 2000 mg 上限，多来自酱料、外卖和加工食品。`,
      '下一餐选清汤少酱汁，用醋、香料提味；包装食品看看配料表和钠含量。');
  }
  if (dims.oilSaltSugar && dims.oilSaltSugar.sub.sugarScore < 60) {
    add(78, '添加糖偏多', `今天估算添加糖约 ${agg.addedSugar} g，高于一般建议的 25 g 以内，含糖饮品和甜点是常见来源。`,
      '把含糖饮料换成白水、无糖茶或气泡水；甜食留着偶尔解馋，不必完全禁止。');
  }
  if (dims.oilSaltSugar && dims.oilSaltSugar.sub.fatScore < 60) {
    add(74, '脂肪比例偏高', `今天估算脂肪供能比约 ${Math.round(agg.fat * 9 / Math.max(agg.kcal, 1) * 100)}%，高于建议的 30% 以内。`,
      '选蒸、煮、炖、快炒的做法，油炸和肥肉类换成瘦肉、鱼虾或豆制品。');
  }
  if (agg.veg < targets.veg * 0.5 || agg.fruit < targets.fruit * 0.5) {
    const miss = [];
    if (agg.veg < targets.veg * 0.5) miss.push(`蔬菜约 ${agg.veg} g（建议 300 g 以上）`);
    if (agg.fruit < targets.fruit * 0.5) miss.push(`水果约 ${agg.fruit} g（建议 200 g 以上）`);
    add(75, '蔬菜水果偏少', `今天${miss.join('，')}。蔬菜水果提供维生素、钾和膳食纤维，是均衡饮食最容易被忽略的部分。`,
      agg.veg < agg.fruit ? '晚餐加一份深色蔬菜，约一拳大小（熟重 150–200 g）。' : '明天加一个拳头大小的水果，比如苹果、橙子或猕猴桃。');
  }
  if (dims.protein.score < 70) {
    add(72, '蛋白质不足', `${dims.protein.reason}`,
      '三餐各安排一份掌心大小的优质蛋白：鸡蛋、鸡胸肉、鱼虾、瘦肉或豆腐都可以。');
  }
  if (dims.calorie.score < 80 && agg.kcal > targets.kcal * 1.1) {
    add(70, '热量略超目标', `${dims.calorie.reason}`,
      '不必刻意节食。明天主食减半碗、多安排蔬菜和优质蛋白，保持日常活动即可。');
  }
  if (dims.calorie.score < 80 && agg.kcal < targets.kcal * 0.8) {
    add(68, '热量偏低', `${dims.calorie.reason}`,
      '长期吃太少容易没精神和掉肌肉。三餐规律一些，每餐加一份主食或蛋白质，避免长时间空腹。');
  }
  if (dims.fiber.score < 70) {
    add(65, '膳食纤维不足', `${dims.fiber.reason}`,
      '把一部分白米饭、白面换成全麦面包、燕麦、玉米或杂豆，再加一把绿叶菜。');
  }
  if (dims.staple.score < 60 && agg.staple > 0) {
    add(62, '主食偏精制', `${dims.staple.reason}`,
      '下次煮饭时掺 1/3 糙米或杂豆，面包选"100% 全麦"的，简单又有效。');
  }
  if (dims.regularity.score < 75) {
    add(60, '进餐不太规律', `${dims.regularity.reason}`,
      '尽量按固定时间吃三餐；早上没胃口，可以先从一个鸡蛋加一杯牛奶开始。');
  }
  if (dims.diversity.score < 70) {
    add(55, '食物种类偏少', `${dims.diversity.reason}`,
      '每天争取凑够 8 类以上：谷薯、蔬菜、水果、肉禽鱼虾、蛋、奶豆、坚果。明天试试加一种今天没吃的类别。');
  }

  list.sort((a, b) => b.sev - a.sev);
  return list.slice(0, 5).map(x => ({ title: x.title, why: x.why, how: x.how }));
}

/* ---------------- 10. 状态与存储 ---------------- */
let state = null;
let editingId = null;   // 当前编辑的食物条目 id
let currentTab = 'record';
let filterMeal = '';    // 今日页餐次筛选
let aiLoading = false;

function defaultProfile() {
  return { goal: '一般健康', gender: 'male', age: 30, height: 170, weight: 65, activity: 'moderate', allergens: [], exclude: '' };
}
function defaultLog(dateStr) {
  return { date: dateStr, meals: { breakfast: [], lunch: [], dinner: [], snack: [] }, water: '', note: '', evaluation: null };
}
function loadState() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { s = null; }
  if (!s || typeof s !== 'object') s = {};
  s.profile = Object.assign(defaultProfile(), s.profile || {});
  s.ai = Object.assign({ enabled: false, apiUrl: '', apiKey: '', model: '' }, s.ai || {});
  s.logs = s.logs || {};
  // 修复老数据缺少的餐次容器
  for (const d in s.logs) s.logs[d].meals = Object.assign({ breakfast: [], lunch: [], dinner: [], snack: [] }, s.logs[d].meals || {});
  return s;
}
function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { toast('保存失败：浏览器存储不可用', true); }
}
function getLog(dateStr, create) {
  if (!state.logs[dateStr]) {
    if (!create) return null;
    state.logs[dateStr] = defaultLog(dateStr);
  }
  return state.logs[dateStr];
}

/* ---------------- 11. AI 解析（可选，OpenAI 兼容接口） ---------------- */
// 把用户填写的地址规范化为完整的 /chat/completions 接口地址
function buildAiUrl(raw) {
  let u = raw.trim().replace(/\/+$/, '');
  if (u.includes('/chat/completions')) return u;                    // 已是完整接口地址
  if (/\/(v\d+[a-z]*|openai)/.test(u)) return u + '/chat/completions'; // 已含版本段，如 /v1、/v1beta、/openai
  return u + '/v1/chat/completions';                                // 只填了域名，自动补 /v1
}

// 发起一次 OpenAI 兼容对话请求，出错时给出可读、可定位的原因
async function aiChat(messages, temperature, maxTokens) {
  const cfg = state.ai;
  if (!cfg.apiUrl || !cfg.apiKey) throw new Error('请先在设置页填写 API 地址和 Key，并点击"保存 AI 设置"');
  const url = buildAiUrl(cfg.apiUrl);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.apiKey },
      body: JSON.stringify(Object.assign(
        { model: cfg.model || 'gpt-4o-mini', messages, temperature },
        maxTokens ? { max_tokens: maxTokens } : {},
      )),
    });
  } catch (e) {
    if (location.protocol === 'https:' && url.startsWith('http://')) {
      throw new Error('页面是 HTTPS 而 API 地址是 HTTP，浏览器已拦截。请把 API 地址改为 https:// 开头');
    }
    throw new Error('无法连接到 API（网络错误或跨域 CORS 被拦截）。请确认：① 地址能访问；② 该服务商允许浏览器网页直接调用；③ 如服务商不允许，需要使用支持 CORS 的服务商或自建代理');
  }
  if (!res.ok) {
    let detail = '';
    try { const j = await res.json(); detail = (j.error && (j.error.message || j.error.code)) || JSON.stringify(j).slice(0, 160); }
    catch (e2) { detail = ''; }
    const hints = {
      400: '请求参数不被接受（常见：模型名不对）',
      401: 'API Key 无效或未生效',
      403: '该 Key 无权限访问此模型或接口',
      404: '接口路径不对，请检查 API 地址（通常应以 /v1/chat/completions 结尾）',
      429: '调用过于频繁或额度已用完',
    };
    throw new Error(`HTTP ${res.status}：${hints[res.status] || '请求失败'}${detail ? ' —— ' + detail : ''}`);
  }
  const data = await res.json();
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '';
  if (!content) throw new Error('API 返回了空内容，请检查模型名是否正确');
  return content;
}

async function aiParse(text) {
  const sys = '你是饮食记录解析助手。把用户的中文饮食描述解析为 JSON 数组，每个元素形如 {"name":"食物名","qty":数量数字,"unit":"碗|杯|个|片|份|盘|根|块|克|毫升 等","meal":"breakfast|lunch|dinner|snack"}。数量为数字，保留"无糖"等修饰进 name。只输出 JSON 数组，不要输出其他内容。';
  const content = await aiChat([{ role: 'system', content: sys }, { role: 'user', content: text }], 0);
  const m = content.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('AI 返回格式无法识别');
  const arr = JSON.parse(m[0]);
  return arr.filter(x => x && x.name).map(x => ({
    name: String(x.name), qty: Number(x.qty) > 0 ? Number(x.qty) : 1,
    unit: UNITS.includes(x.unit) ? x.unit : '份',
    meal: MEAL_ORDER.includes(x.meal) ? x.meal : 'lunch', noSugar: /无糖/.test(x.name), raw: String(x.name),
  }));
}
async function aiSuggestions(evalResult, agg, targets) {
  const dims = Object.keys(SCORING_RULES).map(k => `${SCORING_RULES[k].name}:${dims_get(evalResult, k)}`).join('；');
  const sys = '你是营养科普助手。基于用户当天的饮食汇总与评分，输出不超过 5 条 JSON 建议数组，每条形如 {"title":"短标题","why":"为什么（结合数据，40字内）","how":"具体怎么做（50字内，可执行）"}。语气友好不说教，不给医疗建议，不做极端节食建议。只输出 JSON 数组。';
  const user = `摄入汇总：热量 ${agg.kcal} kcal（目标 ${targets.kcal}），蛋白质 ${agg.protein} g（目标 ${targets.protein}），蔬菜 ${agg.veg} g，水果 ${agg.fruit} g，膳食纤维 ${agg.fiber} g，钠 ${agg.sodium} mg，添加糖 ${agg.addedSugar} g。分项评分：${dims}。`;
  const content = await aiChat([{ role: 'system', content: sys }, { role: 'user', content: user }], 0.3);
  const m = content.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('AI 返回格式无法识别');
  return JSON.parse(m[0]).slice(0, 5).map(x => ({ title: String(x.title || '建议'), why: String(x.why || ''), how: String(x.how || '') }));
}
function dims_get(ev, k) { return ev.dims[k] ? ev.dims[k].score : '无'; }

/* ---------------- 12. 渲染 ---------------- */
function render() {
  const app = document.getElementById('app');
  if (!app) return;
  const nav = `
  <nav class="tabs">
    ${[['record', '记录', '🍽'], ['eval', '评价', '📊'], ['history', '历史', '📈'], ['settings', '设置', '⚙']].map(([k, n, ic]) =>
    `<button class="tab ${currentTab === k ? 'active' : ''}" onclick="app.setTab('${k}')"><span>${ic}</span>${n}</button>`).join('')}
  </nav>`;
  let body = '';
  if (currentTab === 'record') body = renderRecord();
  else if (currentTab === 'eval') body = renderEval();
  else if (currentTab === 'history') body = renderHistory();
  else body = renderSettings();
  app.innerHTML = `
    <header class="app-header"><h1>每日饮食记录</h1><p>吃进肚子的每一口，都值得被温柔对待</p></header>
    <main class="app-main">${body}</main>
    <footer class="footer">${DISCLAIMER_SHORT}<a href="#" onclick="app.setTab('settings');return false;">查看完整声明</a></footer>
    ${nav}`;
}

function renderRecord() {
  const date = state.currentDate || todayStr();
  const log = getLog(date, false);
  const agg = aggregateDay(log);
  const targets = getTargets(state.profile);
  const aiOn = state.ai.enabled && state.ai.apiUrl && state.ai.apiKey;
  const mealSections = MEAL_ORDER.filter(mk => !filterMeal || filterMeal === mk).map(mk => {
    const items = log ? log.meals[mk] : [];
    const mkcal = items.reduce((s, i) => s + (i.pending ? 0 : i.kcal), 0);
    return `<section class="card meal-section">
      <div class="meal-head"><h3>${MEALS[mk]}</h3><span class="muted">${items.length ? items.length + ' 项 · 约 ' + mkcal + ' kcal' : '暂无记录'}</span></div>
      ${items.length ? items.map(it => itemCardHTML(it, date)).join('') : `<p class="empty-tip">还没有${MEALS[mk]}记录，可以在上方输入。</p>`}
    </section>`;
  }).join('');
  return `
  <div class="card">
    <div class="row-between">
      <input type="date" class="input date-input" value="${date}" max="${todayStr()}" onchange="app.setDate(this.value)">
      <button class="btn ghost" onclick="app.fillSample()">示例数据</button>
    </div>
    <div class="day-summary">
      <div><b>${agg.kcal}</b><span>千卡</span></div>
      <div><b>${agg.protein}</b><span>蛋白质 g</span></div>
      <div><b>${agg.veg + agg.fruit}</b><span>蔬果 g</span></div>
      <div><b>${agg.pending}</b><span>待确认</span></div>
    </div>
    <p class="muted small">目标参考：约 ${targets.kcal} kcal / 蛋白质 ${targets.protein} g（估算，可在设置页调整个人资料）</p>
  </div>

  <div class="card">
    <h3>自然语言记录</h3>
    <textarea id="nlInput" class="input" rows="3" placeholder="例如：早餐两个鸡蛋、一杯牛奶、一片全麦面包；中午一碗米饭、鸡胸肉、西兰花；晚上牛肉面，下午一杯奶茶"></textarea>
    <div class="row gap">
      <select id="nlMeal" class="input">
        <option value="">自动识别餐次</option>
        ${MEAL_ORDER.map(mk => `<option value="${mk}">全部记为${MEALS[mk]}</option>`).join('')}
      </select>
      <button class="btn primary" onclick="app.doParse()">${aiLoading ? '解析中…' : (aiOn ? 'AI 解析并添加' : '解析并添加')}</button>
    </div>
    <p class="muted small">${aiOn
    ? '已启用 AI 解析：你输入的食物描述会发送到你配置的 API 服务商。<a href="#" onclick="app.setTab(\'settings\');return false;">设置</a>'
    : '未启用 AI，使用内置规则解析（离线可用）。配置 AI 后解析更自然，见<a href="#" onclick="app.setTab(\'settings\');return false;">设置</a>。'}</p>
  </div>

  <div class="card">
    <h3>添加单项食物</h3>
    <div class="row wrap gap">
      <select id="sfMeal" class="input">${MEAL_ORDER.map(mk => `<option value="${mk}">${MEALS[mk]}</option>`).join('')}</select>
      <input id="sfName" class="input grow" list="foodList" placeholder="食物名，如 鸡胸肉">
      <datalist id="foodList">${FOOD_DB.map(f => `<option value="${f.name}">`).join('')}</datalist>
      <input id="sfQty" class="input num" type="number" min="0.1" step="0.1" value="1">
      <select id="sfUnit" class="input">${UNITS.map(u => `<option>${u}</option>`).join('')}</select>
      <button class="btn primary" onclick="app.addStructured()">添加</button>
    </div>
  </div>
  ${mealSections}
  <div class="card">
    <h3>饮水与备注</h3>
    <div class="row wrap gap">
      <label class="small">饮水（杯）<input type="number" min="0" step="0.5" class="input num" value="${log ? log.water || '' : ''}" onchange="app.saveWater(this.value)"></label>
      <label class="small grow">运动 / 其他备注<input type="text" class="input" value="${log ? esc(log.note || '') : ''}" placeholder="如：快走 30 分钟" onchange="app.saveNote(this.value)"></label>
    </div>
  </div>`;
}

function itemCardHTML(it, date) {
  const editing = editingId === it.id;
  if (editing) {
    return `<div class="item-card editing" data-id="${it.id}">
      <div class="row wrap gap">
        <input id="eName_${it.id}" class="input grow" value="${esc(it.name)}" placeholder="食物名">
        <select id="eMeal_${it.id}" class="input">${MEAL_ORDER.map(mk => `<option value="${mk}" ${it.meal === mk ? 'selected' : ''}>${MEALS[mk]}</option>`).join('')}</select>
        <input id="eQty_${it.id}" class="input num" type="number" min="0.1" step="0.1" value="${it.qty}">
        <select id="eUnit_${it.id}" class="input">${UNITS.map(u => `<option ${it.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select>
      </div>
      ${it.pending ? `
      <p class="warn-text small">该项未识别，请手动填写营养（也可只改名字为近似食物后保存）</p>
      <div class="row wrap gap small-inputs">
        <label>千卡<input id="eKcal_${it.id}" class="input num" type="number" value="${it.kcal || ''}"></label>
        <label>蛋白 g<input id="ePro_${it.id}" class="input num" type="number" step="0.1" value="${it.protein || ''}"></label>
        <label>碳水 g<input id="eCarb_${it.id}" class="input num" type="number" step="0.1" value="${it.carb || ''}"></label>
        <label>脂肪 g<input id="eFat_${it.id}" class="input num" type="number" step="0.1" value="${it.fat || ''}"></label>
        <label>纤维 g<input id="eFib_${it.id}" class="input num" type="number" step="0.1" value="${it.fiber || ''}"></label>
        <label>钠 mg<input id="eNa_${it.id}" class="input num" type="number" value="${it.sodium || ''}"></label>
        <label>糖 g<input id="eSugar_${it.id}" class="input num" type="number" step="0.1" value="${it.sugar || ''}"></label>
      </div>` : ''}
      <div class="row gap item-actions">
        <button class="btn primary sm" onclick="app.saveItemEdit('${date}','${it.id}')">保存</button>
        <button class="btn ghost sm" onclick="app.cancelEdit()">取消</button>
      </div>
    </div>`;
  }
  const range = it.pending ? '—' : `≈${it.kcal} <span class="muted">(${Math.round(it.kcal * 0.85)}–${Math.round(it.kcal * 1.15)})</span>`;
  const allergyHits = (it.allergens || []).filter(a => (state.profile.allergens || []).includes(a));
  const badges = [
    it.pending ? '<span class="badge warn">待确认</span>' : '<span class="badge">估算</span>',
    allergyHits.length ? `<span class="badge danger">⚠ 过敏原：${allergyHits.join('、')}</span>` : '',
    it.note ? `<span class="badge soft">${esc(it.note)}</span>` : '',
  ].join('');
  const nutrients = it.pending ? '<span class="muted">营养待填写</span>' :
    `蛋白质 ${it.protein}g · 碳水 ${it.carb}g · 脂肪 ${it.fat}g · 纤维 ${it.fiber}g · 钠 ${it.sodium}mg · 糖 ${it.sugar}g`;
  return `<div class="item-card">
    <div class="row-between">
      <div class="item-title"><b>${esc(it.name)}</b> <span class="muted small">${it.qty}${it.unit} · ${it.pending ? '—' : it.grams + 'g'}</span></div>
      <div class="kcal">${range} <span class="muted small">kcal</span></div>
    </div>
    <div class="item-badges">${badges}</div>
    <div class="muted small">${nutrients}</div>
    <div class="row gap item-actions">
      <button class="btn ghost sm" onclick="app.editItem('${date}','${it.id}')">编辑</button>
      <button class="btn ghost sm" onclick="app.copyTomorrow('${date}','${it.id}')">复制到明天</button>
      <button class="btn ghost sm danger-text" onclick="app.delItem('${date}','${it.id}')">删除</button>
    </div>
  </div>`;
}

function renderEval() {
  const date = state.currentDate || todayStr();
  const log = getLog(date, false);
  const agg = aggregateDay(log);
  if (agg.count === 0) {
    return `<div class="card center-empty">
      <h3>今天还没有记录</h3>
      <p class="muted">先去"记录"页添加今天吃了什么，再回来生成评价。</p>
      <button class="btn primary" onclick="app.setTab('record')">去记录</button>
    </div>`;
  }
  const targets = getTargets(state.profile);
  const ev = evaluateDay(agg, targets);
  const sugg = (log.evaluation && log.evaluation.aiSuggestions) || buildSuggestions(agg, targets, ev.dims);
  log.evaluation = Object.assign(ev, { aiSuggestions: (log.evaluation && log.evaluation.aiSuggestions) || null }); saveState();
  const ring = scoreRing(ev.total);
  const dimRows = Object.keys(SCORING_RULES).map(k => {
    const r = SCORING_RULES[k], d = ev.dims[k];
    return `<div class="dim-row">
      <div class="dim-head"><b>${r.name}</b><span class="dim-score">${d.score} 分</span></div>
      <div class="bar"><div class="bar-fill ${barColor(d.score)}" style="width:${d.score}%"></div></div>
      <p class="small muted">${esc(d.reason)}</p>
      ${d.tip ? `<p class="small">💡 ${esc(d.tip)}</p>` : ''}
    </div>`;
  }).join('');
  const suggHTML = sugg.length
    ? sugg.map(s => `<div class="sugg"><b>${esc(s.title)}</b><p class="small"><span class="tag-why">为什么</span>${esc(s.why)}</p><p class="small"><span class="tag-how">怎么做</span>${esc(s.how)}</p></div>`).join('')
    : '<p class="muted">今天各维度表现都不错，没有明显短板，继续保持！</p>';
  const aiOn = state.ai.enabled && state.ai.apiUrl && state.ai.apiKey;
  return `
  <div class="card eval-head">
    ${ring}
    <div class="eval-side">
      <h3>${date} 饮食评价</h3>
      <p class="muted small">${ev.total >= 85 ? '整体很均衡，继续保持。' : ev.total >= 70 ? '总体不错，还有几个可以优化的地方。' : '有几点值得改进，别有压力，从最容易的一条开始。'}</p>
      ${aiOn ? '<button class="btn ghost sm" onclick="app.genAiSugg()">用 AI 重新生成建议</button>' : ''}
    </div>
  </div>
  <div class="card"><h3>分项评分（估算依据）</h3>${dimRows}</div>
  <div class="card"><h3>改进建议（按优先级，最多 5 条）</h3>${suggHTML}
    <p class="muted small">以上为一般健康人群的科普建议，不适用于疾病人群；孕期、慢病等特殊情况请咨询专业人士。</p>
  </div>`;
}

function scoreRing(total) {
  if (total == null) return '<div class="ring">—</div>';
  const r = 44, c = 2 * Math.PI * r, off = c * (1 - total / 100);
  const color = total >= 85 ? '#2f9e63' : total >= 70 ? '#d9a406' : '#e0592a';
  return `<svg class="ring" viewBox="0 0 110 110" width="110" height="110">
    <circle cx="55" cy="55" r="${r}" fill="none" stroke="#e8eee9" stroke-width="10"/>
    <circle cx="55" cy="55" r="${r}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 55 55)"/>
    <text x="55" y="60" text-anchor="middle" font-size="26" font-weight="700" fill="${color}">${total}</text>
  </svg>`;
}
function barColor(s) { return s >= 85 ? 'good' : s >= 70 ? 'mid' : 'bad'; }

function renderHistory() {
  const dates = Object.keys(state.logs).sort().reverse();
  if (dates.length === 0) {
    return `<div class="card center-empty">
      <h3>还没有历史记录</h3>
      <p class="muted">记录第一天的饮食后，这里会展示趋势图表。</p>
      <button class="btn primary" onclick="app.setTab('record')">去记录</button>
    </div>`;
  }
  const last7 = [];
  const t = new Date();
  for (let i = 6; i >= 0; i--) { const d = new Date(t); d.setDate(t.getDate() - i); last7.push(fmtDate(d)); }
  const targets = getTargets(state.profile);
  const series = last7.map(d => {
    const agg = aggregateDay(getLog(d, false));
    const ev = aggregateDay(getLog(d, false)).count ? evaluateDay(agg, targets) : null;
    return { date: d, label: d.slice(5).replace('-', '/'), kcal: agg.count ? agg.kcal : null, protein: agg.count ? agg.protein : null, vf: agg.count ? agg.veg + agg.fruit : null, score: ev ? ev.total : null };
  });
  const charts = [
    barChart(`热量（kcal，目标约 ${targets.kcal}）`, series.map(s => ({ label: s.label, value: s.kcal })), '#4f8ef7'),
    barChart('蛋白质（g）', series.map(s => ({ label: s.label, value: s.protein })), '#8e5cf7'),
    barChart('蔬菜+水果（g）', series.map(s => ({ label: s.label, value: s.vf })), '#2f9e63'),
    barChart('总分（0–100）', series.map(s => ({ label: s.label, value: s.score })), '#d9a406'),
  ].join('');
  const dayRows = dates.slice(0, 30).map(d => {
    const log = getLog(d, false);
    const agg = aggregateDay(log);
    const cnt = agg.count;
    return `<div class="day-row">
      <div class="day-info"><b>${d}</b> <span class="muted small">${weekdayLabel(d)}</span>
        <div class="muted small">${cnt ? `${cnt} 项 · 约 ${agg.kcal} kcal` : '无有效记录'}</div></div>
      <div class="row gap">
        <button class="btn ghost sm" onclick="app.viewDay('${d}')">查看/编辑</button>
        <button class="btn ghost sm danger-text" onclick="app.delDay('${d}')">删除</button>
      </div>
    </div>`;
  }).join('');
  return `
  <div class="card"><h3>最近 7 天趋势</h3><div class="chart-grid">${charts}</div></div>
  <div class="card"><h3>历史记录</h3>${dayRows}
    <div class="row gap data-ops">
      <button class="btn ghost" onclick="app.exportData()">导出 JSON</button>
      <button class="btn ghost danger-text" onclick="app.clearAll()">清空全部数据</button>
    </div>
  </div>`;
}

function barChart(title, entries, color) {
  const vals = entries.map(e => e.value).filter(v => v != null);
  const max = Math.max(...vals, 1);
  return `<div class="chart"><div class="chart-title">${esc(title)}</div><div class="chart-bars">
    ${entries.map(e => {
    const h = e.value == null ? 0 : Math.max(3, Math.round(e.value / max * 72));
    return `<div class="chart-col">
        <span class="chart-val">${e.value == null ? '—' : Math.round(e.value)}</span>
        <div class="chart-bar" style="height:${h}px;background:${e.value == null ? '#d8dfd9' : color}"></div>
        <span class="chart-label">${e.label}</span>
      </div>`;
  }).join('')}
  </div></div>`;
}

function renderSettings() {
  const p = state.profile;
  const ai = state.ai;
  return `
  <div class="card">
    <h3>个人资料（用于估算目标，均为近似值）</h3>
    <form onsubmit="return app.saveProfile(event)">
      <div class="row wrap gap">
        <label class="small">目标<select id="pGoal" class="input">${['减脂', '维持', '增肌', '一般健康'].map(g => `<option ${p.goal === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
        <label class="small">性别<select id="pGender" class="input"><option value="male" ${p.gender === 'male' ? 'selected' : ''}>男</option><option value="female" ${p.gender === 'female' ? 'selected' : ''}>女</option></select></label>
        <label class="small">年龄<input id="pAge" class="input num" type="number" min="10" max="100" value="${p.age}"></label>
        <label class="small">身高 cm<input id="pHeight" class="input num" type="number" min="100" max="230" value="${p.height}"></label>
        <label class="small">体重 kg<input id="pWeight" class="input num" type="number" min="25" max="250" step="0.1" value="${p.weight}"></label>
        <label class="small">活动量<select id="pActivity" class="input">
          <option value="low" ${p.activity === 'low' ? 'selected' : ''}>久坐</option>
          <option value="light" ${p.activity === 'light' ? 'selected' : ''}>轻度活动</option>
          <option value="moderate" ${p.activity === 'moderate' ? 'selected' : ''}>中等活动</option>
          <option value="high" ${p.activity === 'high' ? 'selected' : ''}>高强度</option>
        </select></label>
      </div>
      <label class="small block">忌口 / 偏好（可选）<input id="pExclude" class="input" value="${esc(p.exclude || '')}" placeholder="如：不吃香菜、乳糖不耐"></label>
      <h4 class="sub">过敏原（会高亮提醒，但不保证完全安全）</h4>
      <div class="row wrap gap">
        ${ALLERGEN_LIST.map(a => `<label class="check"><input type="checkbox" value="${a}" ${(p.allergens || []).includes(a) ? 'checked' : ''}> ${a}</label>`).join('')}
      </div>
      <button class="btn primary" type="submit">保存资料</button>
      <p class="muted small" id="bmrHint"></p>
    </form>
  </div>

  <div class="card">
    <h3>AI 解析（可选）</h3>
    <p class="muted small">不配置也能完整使用：内置规则解析覆盖常见食物。配置后，自然语言解析与建议生成会调用你自己的大模型接口。</p>
    <p class="warn-text small">⚠ 隐私提示：启用后，你输入的食物描述与当日营养汇总会发送到你配置的 API 服务商。Key 仅保存在本地浏览器，不会上传到其他地方。</p>
    <div class="row wrap gap">
      <label class="check"><input type="checkbox" id="aiEnabled" ${ai.enabled ? 'checked' : ''}> 启用 AI</label>
    </div>
    <label class="small block">API 地址（OpenAI 兼容，如 https://api.deepseek.com/v1 或 https://api.xxx.com/v1/chat/completions）<input id="aiUrl" class="input" value="${esc(ai.apiUrl)}" placeholder="https://api.deepseek.com/v1"></label>
    <label class="small block">API Key<input id="aiKey" class="input" type="password" value="${esc(ai.apiKey)}" placeholder="仅存在本地浏览器"></label>
    <label class="small block">模型名（可选，需与服务商一致，如 deepseek-chat、gpt-4o-mini）<input id="aiModel" class="input" value="${esc(ai.model)}" placeholder="如 deepseek-chat"></label>
    <div class="row gap">
      <button class="btn primary" onclick="app.saveAI()">保存 AI 设置</button>
      <button class="btn ghost" onclick="app.testConnection()">测试连接</button>
    </div>
    <p class="muted small">填法示例：DeepSeek 填 <b>https://api.deepseek.com/v1</b> + 模型 <b>deepseek-chat</b>；通义千问填 <b>https://dashscope.aliyuncs.com/compatible-mode/v1</b> + 模型 <b>qwen-plus</b>。只填域名也可以，会自动补全 /v1/chat/completions。保存后请点"测试连接"。</p>
    <p class="muted small" id="testResult"></p>
  </div>

  <div class="card">
    <h3>关于与免责声明</h3>
    <p class="small">${DISCLAIMER_FULL}</p>
    <p class="muted small">所有数据仅保存在本设备浏览器（localStorage）中，本应用没有服务器、不需要登录。清除浏览器数据会删除记录，建议定期在"历史"页导出 JSON 备份。</p>
  </div>`;
}

/* ---------------- 13. 事件处理 ---------------- */
const app = {
  setTab(t) { currentTab = t; editingId = null; render(); window.scrollTo(0, 0); },
  setDate(d) { if (!d) return; state.currentDate = d; editingId = null; saveState(); render(); },

  // 自然语言解析入口（AI 失败自动回退本地规则）
  async doParse() {
    const el = document.getElementById('nlInput');
    const text = (el.value || '').trim();
    if (!text) { toast('先输入今天吃了什么吧', true); return; }
    const override = document.getElementById('nlMeal').value;
    const apply = (list) => {
      let added = 0, pending = 0;
      const log = getLog(state.currentDate || todayStr(), true);
      for (const p of list) {
        const item = makeItem({ ...p, meal: override || p.meal });
        log.meals[item.meal].push(item);
        added++; if (item.pending) pending++;
      }
      saveState(); render();
      toast(`已添加 ${added} 项${pending ? `，其中 ${pending} 项待确认` : ''}`);
      el.value = '';
    };
    if (state.ai.enabled && state.ai.apiUrl && state.ai.apiKey) {
      aiLoading = true; render();
      try { apply(await aiParse(text)); }
      catch (e) { aiLoading = false; apply(localParse(text)); toast('AI 解析失败，已改用本地规则：' + String(e.message || e).slice(0, 90), true); }
      aiLoading = false;
    } else {
      apply(localParse(text));
    }
  },

  addStructured() {
    const meal = document.getElementById('sfMeal').value;
    const name = document.getElementById('sfName').value.trim();
    const qty = parseFloat(document.getElementById('sfQty').value) || 1;
    const unit = document.getElementById('sfUnit').value;
    if (!name) { toast('请输入食物名', true); return; }
    const log = getLog(state.currentDate || todayStr(), true);
    log.meals[meal].push(makeItem({ name, qty, unit, meal, raw: name }));
    saveState(); render();
    toast('已添加' + (matchFood(name) ? '' : '（未识别，标记为待确认）'));
  },

  editItem(date, id) { editingId = id; render(); },
  cancelEdit() { editingId = null; render(); },

  saveItemEdit(date, id) {
    const log = getLog(date, false); if (!log) return;
    const item = findItem(log, id); if (!item) return;
    const g = (k) => { const e = document.getElementById(k + '_' + id); return e ? e.value : null; };
    const name = (g('eName') || '').trim() || item.name;
    const meal = g('eMeal') || item.meal;
    const qty = parseFloat(g('eQty')) || item.qty;
    const unit = g('eUnit') || item.unit;
    // 尝试按新名字重新匹配食物库
    const food = matchFood(name);
    if (food && food.name !== item.food) {
      const ni = makeItem({ name, qty, unit, meal, raw: item.raw });
      Object.assign(item, ni, { id: item.id });
    } else {
      item.name = name; item.meal = meal; item.qty = qty; item.unit = unit;
      if (food) { // 同一食物，按份量重算
        const ni = makeItem({ name, qty, unit, meal, raw: item.raw, noSugar: /无糖/.test(name) });
        Object.assign(item, ni, { id: item.id });
      } else if (item.pending || g('eKcal') != null) { // 手动填写营养
        item.pending = false; item.food = null; item.estimated = true;
        item.kcal = Math.round(parseFloat(g('eKcal')) || 0);
        item.protein = round1(parseFloat(g('ePro')) || 0);
        item.carb = round1(parseFloat(g('eCarb')) || 0);
        item.fat = round1(parseFloat(g('eFat')) || 0);
        item.fiber = round1(parseFloat(g('eFib')) || 0);
        item.sodium = Math.round(parseFloat(g('eNa')) || 0);
        item.sugar = round1(parseFloat(g('eSugar')) || 0);
        item.note = '手动填写';
      }
    }
    editingId = null; saveState(); render();
    toast('已保存（营养均为估算值）');
  },

  delItem(date, id) {
    if (!confirm('确定删除这条食物记录吗？')) return;
    const log = getLog(date, false); if (!log) return;
    for (const mk of MEAL_ORDER) {
      const idx = log.meals[mk].findIndex(i => i.id === id);
      if (idx >= 0) { log.meals[mk].splice(idx, 1); break; }
    }
    saveState(); render(); toast('已删除');
  },

  copyTomorrow(date, id) {
    const log = getLog(date, false); if (!log) return;
    const item = findItem(log, id); if (!item) return;
    const nd = nextDateStr(date);
    const clone = Object.assign({}, item, { id: uid() });
    getLog(nd, true).meals[clone.meal].push(clone);
    saveState(); render(); toast(`已复制到 ${nd} 的${MEALS[clone.meal]}`);
  },

  fillSample() {
    const text = '早餐两个鸡蛋、一杯牛奶、一片全麦面包；中午一碗米饭、一份鸡胸肉、半盘西兰花；晚上牛肉面，下午喝了一杯奶茶。';
    const log = getLog(state.currentDate || todayStr(), true);
    for (const p of localParse(text)) log.meals[p.meal].push(makeItem(p));
    saveState(); render(); toast('示例数据已添加');
  },

  saveWater(v) { const log = getLog(state.currentDate || todayStr(), true); log.water = v; saveState(); },
  saveNote(v) { const log = getLog(state.currentDate || todayStr(), true); log.note = v; saveState(); },

  saveProfile(ev) {
    ev.preventDefault();
    const p = state.profile;
    p.goal = document.getElementById('pGoal').value;
    p.gender = document.getElementById('pGender').value;
    p.age = clamp(parseInt(document.getElementById('pAge').value) || 30, 10, 100);
    p.height = clamp(parseFloat(document.getElementById('pHeight').value) || 170, 100, 230);
    p.weight = clamp(parseFloat(document.getElementById('pWeight').value) || 65, 25, 250);
    p.activity = document.getElementById('pActivity').value;
    p.exclude = document.getElementById('pExclude').value.trim();
    p.allergens = Array.from(document.querySelectorAll('.card input[type=checkbox]:checked'))
      .map(c => c.value).filter(v => ALLERGEN_LIST.includes(v));
    saveState(); render(); toast('资料已保存（BMR/TDEE 为估算值）');
    return false;
  },

  saveAI() {
    state.ai = {
      enabled: document.getElementById('aiEnabled').checked,
      apiUrl: document.getElementById('aiUrl').value.trim(),
      apiKey: document.getElementById('aiKey').value.trim(),
      model: document.getElementById('aiModel').value.trim(),
    };
    saveState(); render();
    toast(state.ai.enabled && state.ai.apiUrl && state.ai.apiKey ? 'AI 已启用' : 'AI 未完整配置，将使用本地规则');
  },

  // 连接测试：读取表单当前值（无需先保存），发一条极小请求并显示真实结果
  async testConnection() {
    const el = document.getElementById('testResult');
    const get = id => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
    if (el) el.textContent = '测试中…';
    const saved = state.ai;
    state.ai = {
      enabled: true,
      apiUrl: get('aiUrl') || saved.apiUrl,
      apiKey: get('aiKey') || saved.apiKey,
      model: get('aiModel') || saved.model,
    };
    try {
      const url = buildAiUrl(state.ai.apiUrl);
      const content = await aiChat([{ role: 'user', content: '回复"OK"两个字' }], 0, 10);
      if (el) el.innerHTML = `<span style="color:var(--primary)">✔ 连接成功（${esc(url)}）—— 模型回复：${esc(content.slice(0, 40))}</span>`;
      toast('AI 连接测试成功');
    } catch (e) {
      const msg = String(e.message || e);
      if (el) el.innerHTML = `<span style="color:var(--danger)">✘ ${esc(msg)}</span>`;
      toast('连接测试未通过，原因见下方说明', true);
    } finally {
      state.ai = saved;
    }
  },

  async genAiSugg() {
    const date = state.currentDate || todayStr();
    const log = getLog(date, false); if (!log) return;
    const agg = aggregateDay(log);
    const targets = getTargets(state.profile);
    const ev = log.evaluation || evaluateDay(agg, targets);
    if (!log.evaluation || !log.evaluation.suggestions_ai) {
      log.evaluation = Object.assign(ev, { suggestions_ai: true });
    }
    try {
      const list = await aiSuggestions(ev, agg, targets);
      log.evaluation.aiSuggestions = list;
      saveState(); render(); toast('AI 建议已生成');
    } catch (e) {
      saveState(); render(); toast('AI 建议生成失败，已显示规则建议：' + String(e.message || e).slice(0, 90), true);
    }
  },

  viewDay(d) { state.currentDate = d; currentTab = 'record'; saveState(); render(); window.scrollTo(0, 0); },

  delDay(d) {
    if (!confirm(`确定删除 ${d} 的全部记录吗？`)) return;
    delete state.logs[d];
    if (state.currentDate === d) state.currentDate = todayStr();
    saveState(); render(); toast('已删除该日记录');
  },

  exportData() {
    const payload = { exportedAt: new Date().toISOString(), app: 'diet-mvp', profile: state.profile, logs: state.logs };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `饮食记录_${todayStr()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    toast('已导出 JSON 备份');
  },

  clearAll() {
    if (!confirm('将删除全部本地数据（包括历史记录和个人资料），且无法恢复。确定继续吗？')) return;
    if (!confirm('再次确认：真的要清空全部数据吗？建议先导出 JSON 备份。')) return;
    state.logs = {}; state.profile = defaultProfile(); state.currentDate = todayStr();
    saveState(); render(); toast('已清空全部数据');
  },
};
window.app = app;

function findItem(log, id) {
  for (const mk of MEAL_ORDER) {
    const it = log.meals[mk].find(i => i.id === id);
    if (it) return it;
  }
  return null;
}

/* ---------------- 14. 轻提示 ---------------- */
let toastTimer = null;
function toast(msg, isErr) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 2600);
}

/* ---------------- 15. 初始化（浏览器环境才执行 DOM 逻辑） ---------------- */
function initApp() {
  state = loadState();
  if (!state.currentDate) state.currentDate = todayStr();
  saveState();
  render();
}
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp);
  else initApp();
}
