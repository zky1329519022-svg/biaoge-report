(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    fileInput: $('fileInput'), chooseFile: $('chooseFile'), loadDemo: $('loadDemo'), dropZone: $('dropZone'),
    statusLine: $('statusLine'), report: $('report'), exportReport: $('exportReport'), reportTitle: $('reportTitle'),
    dateRange: $('dateRange'), revenue: $('revenue'), orders: $('orders'), aov: $('aov'), refund: $('refund'),
    revenueNote: $('revenueNote'), ordersNote: $('ordersNote'), refundNote: $('refundNote'),
    chart: $('trendChart'), chartEmpty: $('chartEmpty'), channelRanking: $('channelRanking'),
    productTable: $('productTable'), rowCount: $('rowCount'), toast: $('toast')
  };

  const aliases = {
    date: ['日期', '下单日期', '订单日期', '创建时间', '时间', 'date', 'orderdate', 'createdat'],
    amount: ['金额', '销售额', '实付金额', '支付金额', '订单金额', '收入', 'amount', 'revenue', 'sales', 'total'],
    product: ['商品', '商品名称', '产品', '产品名称', '品名', 'product', 'item', 'sku'],
    channel: ['渠道', '平台', '来源', '销售渠道', 'channel', 'platform', 'source'],
    order: ['订单号', '订单id', '订单编号', 'orderid', 'orderno', 'id'],
    status: ['状态', '订单状态', 'status'],
    refund: ['退款金额', '退款', '退货金额', 'refund', 'refundamount']
  };

  const demo = [
    ['日期','订单号','商品','渠道','实付金额','订单状态','退款金额'],
    ['2026-09-14','A1021','轻量通勤包','微信小店','329','已完成','0'],
    ['2026-09-14','A1022','磁吸桌面架','淘宝','169','已完成','0'],
    ['2026-09-15','A1023','轻量通勤包','抖音商城','329','已完成','0'],
    ['2026-09-15','A1024','旅行收纳组','微信小店','219','已完成','0'],
    ['2026-09-16','A1025','磁吸桌面架','淘宝','169','已完成','0'],
    ['2026-09-16','A1026','旅行收纳组','抖音商城','219','退款','219'],
    ['2026-09-17','A1027','轻量通勤包','微信小店','329','已完成','0'],
    ['2026-09-17','A1028','防泼水电脑套','淘宝','199','已完成','0'],
    ['2026-09-18','A1029','轻量通勤包','抖音商城','329','已完成','0'],
    ['2026-09-18','A1030','旅行收纳组','微信小店','219','已完成','0'],
    ['2026-09-19','A1031','防泼水电脑套','淘宝','199','已完成','0'],
    ['2026-09-20','A1032','轻量通勤包','微信小店','329','已完成','0']
  ];

  const normalize = (value) => String(value || '').trim().toLowerCase().replace(/[\s_\-（）()]/g, '');
  const currency = (value) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(value || 0);
  const number = (value) => Number(String(value || '').replace(/[¥￥,\s]/g, '')) || 0;
  const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', quoted = false;
    const input = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < input.length; i++) {
      const char = input[i], next = input[i + 1];
      if (char === '"' && quoted && next === '"') { field += '"'; i++; }
      else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) { row.push(field.trim()); field = ''; }
      else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && next === '\n') i++;
        row.push(field.trim());
        if (row.some(Boolean)) rows.push(row);
        row = []; field = '';
      } else field += char;
    }
    row.push(field.trim());
    if (row.some(Boolean)) rows.push(row);
    return rows;
  }

  function detectColumns(headers) {
    const normalized = headers.map(normalize);
    const result = {};
    Object.entries(aliases).forEach(([key, words]) => {
      result[key] = normalized.findIndex((header) => words.some((word) => header === normalize(word) || header.includes(normalize(word))));
    });
    return result;
  }

  function toDate(value) {
    const raw = String(value || '').trim().replace(/[./]/g, '-');
    const date = new Date(raw.includes('T') ? raw : `${raw}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function aggregate(rows) {
    if (rows.length < 2) throw new Error('文件中没有可统计的数据');
    const headers = rows[0];
    const columns = detectColumns(headers);
    if (columns.amount < 0) throw new Error('未找到金额列，请使用“销售额、实付金额、amount”等字段名');

    const records = rows.slice(1).filter((row) => row.some(Boolean)).map((row, index) => {
      const amount = number(row[columns.amount]);
      const refund = columns.refund >= 0 ? number(row[columns.refund]) : 0;
      const status = columns.status >= 0 ? String(row[columns.status] || '') : '';
      const refunded = /退款|退货|取消|关闭|refund|cancel/i.test(status);
      return {
        date: columns.date >= 0 ? toDate(row[columns.date]) : null,
        amount: refunded && !refund ? 0 : amount,
        originalAmount: amount,
        refund: refund || (refunded ? amount : 0),
        product: columns.product >= 0 ? row[columns.product] || '未分类商品' : '未分类商品',
        channel: columns.channel >= 0 ? row[columns.channel] || '未分类渠道' : '未分类渠道',
        order: columns.order >= 0 ? row[columns.order] || `第 ${index + 1} 行` : `第 ${index + 1} 行`,
        valid: !refunded
      };
    });

    const valid = records.filter((r) => r.valid);
    const revenue = valid.reduce((sum, r) => sum + r.amount, 0);
    const refund = records.reduce((sum, r) => sum + r.refund, 0);
    const orderIds = new Set(valid.map((r) => r.order));
    const dates = records.map((r) => r.date).filter(Boolean).sort((a, b) => a - b);
    return {
      records, revenue, refund, orders: orderIds.size,
      aov: orderIds.size ? revenue / orderIds.size : 0,
      start: dates[0] || null, end: dates[dates.length - 1] || null,
      products: group(valid, 'product'), channels: group(valid, 'channel'), daily: groupByDate(valid)
    };
  }

  function group(records, key) {
    const map = new Map();
    records.forEach((record) => {
      const name = String(record[key] || '未分类');
      const current = map.get(name) || { name, amount: 0, orders: new Set() };
      current.amount += record.amount;
      current.orders.add(record.order);
      map.set(name, current);
    });
    return [...map.values()].map((item) => ({ ...item, orders: item.orders.size })).sort((a, b) => b.amount - a.amount);
  }

  function groupByDate(records) {
    const map = new Map();
    records.filter((r) => r.date).forEach((record) => {
      const key = `${record.date.getFullYear()}-${String(record.date.getMonth()+1).padStart(2,'0')}-${String(record.date.getDate()).padStart(2,'0')}`;
      map.set(key, (map.get(key) || 0) + record.amount);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount }));
  }

  function render(data, sourceName) {
    els.report.classList.add('ready');
    els.exportReport.disabled = false;
    els.reportTitle.textContent = sourceName === '演示数据' ? '演示店铺经营周报' : `${sourceName.replace(/\.csv$/i, '')} · 经营周报`;
    els.dateRange.textContent = data.start ? `${formatDate(data.start)} — ${formatDate(data.end)}` : '文件未包含可识别日期';
    els.revenue.textContent = currency(data.revenue);
    els.orders.textContent = data.orders.toLocaleString('zh-CN');
    els.aov.textContent = currency(data.aov);
    els.refund.textContent = currency(data.refund);
    els.revenueNote.textContent = data.products[0] ? `${data.products[0].name} 贡献最高` : '暂无商品字段';
    els.ordersNote.textContent = `${data.records.length} 行原始记录`;
    const total = data.revenue + data.refund;
    els.refundNote.textContent = total ? `退款占流水 ${(data.refund / total * 100).toFixed(1)}%` : '暂无退款';
    els.rowCount.textContent = `${data.records.length} 条记录`;

    els.channelRanking.innerHTML = data.channels.length ? data.channels.slice(0, 5).map((item) => `
      <li><div><strong>${escapeHtml(item.name)}</strong><small>${item.orders} 笔订单</small></div><strong>${currency(item.amount)}</strong></li>`).join('') : '<li class="placeholder">暂无渠道字段</li>';

    els.productTable.innerHTML = data.products.length ? data.products.slice(0, 8).map((item) => `
      <tr><td>${escapeHtml(item.name)}</td><td>${item.orders}</td><td>${currency(item.amount)}</td><td>${data.revenue ? (item.amount / data.revenue * 100).toFixed(1) : '0.0'}%</td></tr>`).join('') : '<tr><td colspan="4" class="placeholder">暂无商品字段</td></tr>';

    drawChart(data.daily);
    els.statusLine.innerHTML = `<span class="status-dot"></span><span>已在本地完成 ${data.records.length} 条记录的分析，数据未上传</span>`;
    showToast('周报已生成，可打印或保存为 PDF');
    document.title = `${els.reportTitle.textContent} · 表策`;
  }

  function drawChart(points) {
    const canvas = els.chart;
    const box = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, box.width * ratio); canvas.height = Math.max(1, box.height * ratio);
    const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio);
    const width = box.width, height = box.height, pad = { top: 16, right: 12, bottom: 28, left: 54 };
    ctx.clearRect(0, 0, width, height);
    if (!points.length) { els.chartEmpty.hidden = false; return; }
    els.chartEmpty.hidden = true;
    const max = Math.max(...points.map((p) => p.amount), 1);
    const chartW = width - pad.left - pad.right, chartH = height - pad.top - pad.bottom;
    ctx.font = '12px Inter, sans-serif'; ctx.fillStyle = '#8094a2'; ctx.strokeStyle = 'rgba(185,215,224,.12)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + chartH * i / 4;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
      ctx.fillText(Math.round(max * (1 - i / 4)).toLocaleString('zh-CN'), 4, y + 4);
    }
    const coords = points.map((point, i) => ({
      x: pad.left + (points.length === 1 ? chartW / 2 : chartW * i / (points.length - 1)),
      y: pad.top + chartH * (1 - point.amount / max), point
    }));
    const gradient = ctx.createLinearGradient(0, pad.top, 0, height - pad.bottom);
    gradient.addColorStop(0, 'rgba(60,230,196,.28)'); gradient.addColorStop(1, 'rgba(60,230,196,0)');
    ctx.beginPath(); ctx.moveTo(coords[0].x, height - pad.bottom); coords.forEach((p) => ctx.lineTo(p.x, p.y)); ctx.lineTo(coords.at(-1).x, height - pad.bottom); ctx.closePath(); ctx.fillStyle = gradient; ctx.fill();
    ctx.beginPath(); coords.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.strokeStyle = '#3ce6c4'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
    coords.forEach((p, i) => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fillStyle = '#07111f'; ctx.fill(); ctx.strokeStyle = '#3ce6c4'; ctx.lineWidth = 2; ctx.stroke();
      if (points.length <= 8 || i % Math.ceil(points.length / 7) === 0) { ctx.fillStyle = '#8094a2'; ctx.textAlign = 'center'; ctx.fillText(p.point.date.slice(5), p.x, height - 7); }
    });
  }

  function formatDate(date) { return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }).format(date); }
  function showToast(message) { els.toast.textContent = message; els.toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2800); }

  function processRows(rows, name) {
    try { render(aggregate(rows), name); }
    catch (error) { showToast(error.message); els.statusLine.innerHTML = `<span class="status-dot" style="background:var(--danger)"></span><span>${escapeHtml(error.message)}</span>`; }
  }

  function processFile(file) {
    if (!file || !/\.csv$/i.test(file.name)) { showToast('请选择 CSV 文件'); return; }
    if (file.size > 10 * 1024 * 1024) { showToast('文件请控制在 10 MB 以内'); return; }
    const reader = new FileReader();
    reader.onload = () => processRows(parseCSV(reader.result), file.name);
    reader.onerror = () => showToast('文件读取失败，请重试');
    reader.readAsText(file, 'utf-8');
  }

  function copyBrief(type) {
    const monthly = type === 'monthly';
    const text = monthly
      ? '我需要持续数据服务。数据来源：____；每周处理次数：____；需要的核心指标：____；当前表格的主要问题：____。'
      : '我需要一次性代配置。数据来源：____；订单表字段：____；希望生成的指标：____；期望交付时间：____。';
    navigator.clipboard?.writeText(text).then(() => showToast('合作需求已复制')).catch(() => showToast(text));
  }

  els.chooseFile.addEventListener('click', () => els.fileInput.click());
  els.fileInput.addEventListener('change', (event) => processFile(event.target.files[0]));
  els.loadDemo.addEventListener('click', () => processRows(demo, '演示数据'));
  els.exportReport.addEventListener('click', () => window.print());
  $('copyBrief').addEventListener('click', () => copyBrief('once'));
  $('copyMonthlyBrief').addEventListener('click', () => copyBrief('monthly'));
  document.querySelector('.jump-workspace').addEventListener('click', () => $('workspace').scrollIntoView({ behavior: 'smooth' }));
  ['dragenter', 'dragover'].forEach((eventName) => els.dropZone.addEventListener(eventName, (event) => { event.preventDefault(); els.dropZone.classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach((eventName) => els.dropZone.addEventListener(eventName, (event) => { event.preventDefault(); els.dropZone.classList.remove('dragging'); }));
  els.dropZone.addEventListener('drop', (event) => processFile(event.dataTransfer.files[0]));
  let chartResize;
  window.addEventListener('resize', () => { clearTimeout(chartResize); chartResize = setTimeout(() => { if (window.currentReport) drawChart(window.currentReport.daily); }, 150); });

  const modelContext = document.modelContext;
  if (modelContext?.registerTool) {
    const lifecycle = new AbortController();
    Promise.resolve(modelContext.registerTool({
      name: 'analyze_sales_csv',
      title: '分析销售 CSV',
      description: '分析提供的 CSV 文本，并在页面中生成销售周报。CSV 必须包含金额列。',
      inputSchema: {
        type: 'object',
        properties: {
          csvText: { type: 'string', description: '包含表头和数据行的完整 CSV 文本' },
          reportName: { type: 'string', description: '显示在周报标题中的名称' }
        },
        required: ['csvText'],
        additionalProperties: false
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        if (!input || typeof input.csvText !== 'string' || !input.csvText.trim()) throw new Error('csvText 不能为空');
        const data = aggregate(parseCSV(input.csvText));
        render(data, typeof input.reportName === 'string' && input.reportName.trim() ? input.reportName.trim() : 'AI 导入数据');
        return { rows: data.records.length, revenue: data.revenue, orders: data.orders, refund: data.refund };
      }
    }, { signal: lifecycle.signal })).catch(() => {});
  }

  const originalRender = render;
  render = function(data, sourceName) { window.currentReport = data; originalRender(data, sourceName); };

  if (new URLSearchParams(window.location.search).has('demo')) processRows(demo, '演示数据');
})();
