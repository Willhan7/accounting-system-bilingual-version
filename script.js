// 记账数据管理模块
const STORAGE_KEY = 'company_records';

const DepartmentList = ['产品设计', '数字人流量', '博彩'];
const departmentColors = {
  '产品设计': '#4A90E2',    // 蓝色
  '数字人流量': '#F5A623',  // 橙色
  '博彩': '#8e44ad'        // 紫色
};

function loadRecords() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// 预留：API 同步接口
async function syncToCloud(records) {
  // TODO: 可接入 Supabase/Google Sheets API
  // await fetch('YOUR_API_ENDPOINT', { method: 'POST', body: JSON.stringify(records) })
}

async function fetchFromCloud() {
  // TODO: 可接入 Supabase/Google Sheets API
  // const res = await fetch('YOUR_API_ENDPOINT');
  // return await res.json();
}

// 表单与渲染模块
const form = document.getElementById('record-form');
const tableBody = document.getElementById('records-table');
const totalIncomeEl = document.getElementById('total-income');
totalIncomeEl.textContent = '0';
const totalExpenseEl = document.getElementById('total-expense');
totalExpenseEl.textContent = '0';
const netProfitEl = document.getElementById('net-profit');
netProfitEl.textContent = '0';

let records = loadRecords();

function renderTable(records) {
  tableBody.innerHTML = '';
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
  sorted.forEach((r, idx) => {
    const tr = document.createElement('tr');
    // 生成每个字段的td
    const fields = ['date', 'type', 'amount', 'department', 'category', 'project', 'note'];
    fields.forEach(field => {
      const td = document.createElement('td');
      td.className = 'px-2 py-1 cursor-pointer';
      td.textContent = r[field] || '';
      // 允许所有字段编辑
      td.addEventListener('dblclick', function () {
        if (tr.classList.contains('editing')) return;
        tr.classList.add('editing');
        // 禁用删除按钮
        const delBtn = tr.querySelector('.delete-btn');
        if (delBtn) delBtn.disabled = true;
        const oldValue = td.textContent;
        let input;
        if (field === 'amount') {
          input = document.createElement('input');
          input.type = 'number';
          input.value = oldValue;
          input.className = 'border rounded px-1 py-0.5 w-full';
        } else if (field === 'date') {
          input = document.createElement('input');
          input.type = 'date';
          input.value = r[field];
          input.className = 'border rounded px-1 py-0.5 w-full';
        } else if (field === 'department') {
          input = document.createElement('select');
          input.className = 'border rounded px-1 py-0.5 w-full';
          DepartmentList.forEach(dep => {
            const opt = document.createElement('option');
            opt.value = dep;
            opt.textContent = dep;
            if (dep === r[field]) opt.selected = true;
            input.appendChild(opt);
          });
        } else if (field === 'type') {
          input = document.createElement('select');
          input.className = 'border rounded px-1 py-0.5 w-full';
          ['收入', '支出'].forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            if (t === r[field]) opt.selected = true;
            input.appendChild(opt);
          });
        } else {
          input = document.createElement('input');
          input.type = 'text';
          input.value = oldValue;
          input.className = 'border rounded px-1 py-0.5 w-full';
        }
        td.textContent = '';
        td.appendChild(input);
        input.focus();
        if (input.select) input.select();
        // 监听回车/ESC
        input.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            let newValue;
            if (field === 'department') {
              newValue = input.value;
            } else {
              newValue = input.value;
            }
            if (field === 'amount' && isNaN(Number(newValue))) return;
            r[field] = field === 'amount' ? Number(newValue) : newValue;
            saveRecords(records);
            refreshAll();
          } else if (e.key === 'Escape') {
            td.textContent = oldValue;
            tr.classList.remove('editing');
            if (delBtn) delBtn.disabled = false;
          }
        });
        // select 组件监听 change+blur
        if (field === 'department' || field === 'type') {
          input.addEventListener('change', function() {
            r[field] = input.value;
            saveRecords(records);
            refreshAll();
          });
        }
        // 失焦时自动还原（不保存）
        input.addEventListener('blur', function() {
          if (tr.classList.contains('editing')) {
            td.textContent = oldValue;
            tr.classList.remove('editing');
            if (delBtn) delBtn.disabled = false;
          }
        });
      });
      tr.appendChild(td);
    });
    // 删除按钮
    const tdDel = document.createElement('td');
    tdDel.className = 'px-2 py-1 text-center';
    const btn = document.createElement('button');
    btn.innerHTML = '🗑️';
    btn.className = 'delete-btn text-red-500 hover:text-red-700 text-lg';
    btn.title = '删除';
    btn.addEventListener('click', function () {
      if (tr.classList.contains('editing')) return;
      records.splice(records.indexOf(r), 1);
      saveRecords(records);
      refreshAll();
    });
    tdDel.appendChild(btn);
    tr.appendChild(tdDel);
    tableBody.appendChild(tr);
  });
}

function getMonthRecords(records) {
  const now = new Date();
  const ym = now.toISOString().slice(0, 7);
  return records.filter(r => r.date.startsWith(ym));
}

function renderOverview(records) {
  const monthRecords = getMonthRecords(records);
  let income = 0, expense = 0;
  for (const r of monthRecords) {
    if (r.type === '收入') income += Number(r.amount);
    else if (r.type === '支出') expense += Number(r.amount);
  }
  totalIncomeEl.textContent = income.toFixed(2);
  totalExpenseEl.textContent = expense.toFixed(2);
  netProfitEl.textContent = (income - expense).toFixed(2);
}

// 图表模块
let expensePieChart, incomePieChart, barChart, lineChart;

function renderPieChart(records, type, canvasId, title) {
  const monthRecords = getMonthRecords(records).filter(r => r.type === type);
  const deptSum = {};
  DepartmentList.forEach(d => deptSum[d] = 0);
  for (const r of monthRecords) {
    deptSum[r.department] = (deptSum[r.department] || 0) + Number(r.amount);
  }
  const data = DepartmentList.map(d => deptSum[d]);
  // 动态颜色绑定
  const colors = DepartmentList.map(d => departmentColors[d] || '#CCCCCC');
  if (window[canvasId + 'Obj']) window[canvasId + 'Obj'].destroy();
  window[canvasId + 'Obj'] = new Chart(document.getElementById(canvasId), {
    type: 'doughnut',
    data: {
      labels: DepartmentList,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: colors,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 16 } } },
        title: { display: true, text: title, font: { size: 18 } },
        tooltip: {
          bodyFont: { size: 16 },
          titleFont: { size: 16 },
          callbacks: {
            label: function(context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const value = context.parsed;
              const percent = total ? (value / total * 100).toFixed(1) : 0;
              return `${context.label}: ¥${value} (${percent}%)`;
            }
          }
        }
      }
    }
  });
}

function renderBarChart(records) {
  const monthRecords = getMonthRecords(records);
  const incomeMap = {}, expenseMap = {}, profitMap = {};
  DepartmentList.forEach(d => {
    incomeMap[d] = 0;
    expenseMap[d] = 0;
    profitMap[d] = 0;
  });
  for (const r of monthRecords) {
    if (r.type === '收入') incomeMap[r.department] += Number(r.amount);
    if (r.type === '支出') expenseMap[r.department] += Number(r.amount);
  }
  DepartmentList.forEach(d => {
    profitMap[d] = incomeMap[d] - expenseMap[d];
  });
  // 动态颜色绑定
  const barColors = DepartmentList.map(d => departmentColors[d] || '#CCCCCC');
  if (barChart) barChart.destroy();
  barChart = new Chart(document.getElementById('bar-chart'), {
    type: 'bar',
    data: {
      labels: DepartmentList,
      datasets: [
        {
          label: '收入',
          data: DepartmentList.map(d => incomeMap[d]),
          backgroundColor: barColors,
          borderColor: barColors,
          borderWidth: 1
        },
        {
          label: '支出',
          data: DepartmentList.map(d => expenseMap[d]),
          backgroundColor: barColors.map(c => c + '99'),
          borderColor: barColors.map(c => c + '99'),
          borderWidth: 1
        },
        {
          label: '净利润',
          data: DepartmentList.map(d => profitMap[d]),
          backgroundColor: barColors.map(c => c + '55'),
          borderColor: barColors.map(c => c + '55'),
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top', labels: { font: { size: 16 } } },
        title: { display: true, text: '部门收支对比（收入/支出/净利润）', font: { size: 18 } },
        tooltip: {
          bodyFont: { size: 16 },
          titleFont: { size: 16 },
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ¥${context.parsed.y}`;
            }
          }
        }
      },
      scales: {
        x: { title: { display: true, text: '部门', font: { size: 16 } }, ticks: { font: { size: 16 } } },
        y: { title: { display: true, text: '金额', font: { size: 16 } }, ticks: { font: { size: 16 } } }
      }
    }
  });
}

function renderLineChart(records) {
  const monthRecords = getMonthRecords(records);
  const dayMap = {};
  for (const r of monthRecords) {
    if (!dayMap[r.date]) dayMap[r.date] = 0;
    dayMap[r.date] += r.type === '收入' ? Number(r.amount) : -Number(r.amount);
  }
  const days = Object.keys(dayMap).sort();
  const netArr = days.map(d => dayMap[d]);
  if (lineChart) lineChart.destroy();
  lineChart = new Chart(document.getElementById('line-chart'), {
    type: 'line',
    data: {
      labels: days,
      datasets: [{
        label: '净收入',
        data: netArr,
        fill: false,
        borderColor: '#4A90E2',
        backgroundColor: 'rgba(74,144,226,0.1)',
        tension: 0.2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false, labels: { font: { size: 16 } } },
        title: { display: true, text: '每日净收入趋势', font: { size: 18 } },
        tooltip: {
          bodyFont: { size: 16 },
          titleFont: { size: 16 }
        }
      },
      scales: {
        x: { title: { display: true, text: '日期', font: { size: 16 } }, ticks: { font: { size: 16 } } },
        y: { title: { display: true, text: '净收入', font: { size: 16 } }, ticks: { font: { size: 16 } } }
      }
    }
  });
}

function refreshAll() {
  renderTable(records);
  renderOverview(records);
  renderPieChart(records, '支出', 'expense-pie-chart', '本月各部门支出占比');
  renderPieChart(records, '收入', 'income-pie-chart', '本月各部门收入占比');
  renderBarChart(records);
  renderLineChart(records);
}

// 分类下拉与自定义输入联动（收入/支出）
const typeSelect = document.getElementById('type');
const expenseCategorySelect = document.getElementById('expense-category-select');
const incomeCategorySelect = document.getElementById('income-category-select');
const categoryCustom = document.getElementById('category-custom');

function updateCategorySelect() {
  if (!typeSelect) return;
  if (typeSelect.value === '收入') {
    expenseCategorySelect.classList.add('hidden');
    incomeCategorySelect.classList.remove('hidden');
    categoryCustom.classList.add('hidden');
    categoryCustom.required = false;
    expenseCategorySelect.value = '办公';
  } else {
    expenseCategorySelect.classList.remove('hidden');
    incomeCategorySelect.classList.add('hidden');
    categoryCustom.classList.add('hidden');
    categoryCustom.required = false;
    incomeCategorySelect.value = '用户付费';
  }
}
if (typeSelect && expenseCategorySelect && incomeCategorySelect) {
  typeSelect.addEventListener('change', updateCategorySelect);
  updateCategorySelect();
}
// 支出分类自定义
if (expenseCategorySelect && categoryCustom) {
  expenseCategorySelect.addEventListener('change', function() {
    if (expenseCategorySelect.value === '自定义') {
      categoryCustom.classList.remove('hidden');
      categoryCustom.required = true;
      categoryCustom.focus();
    } else {
      categoryCustom.classList.add('hidden');
      categoryCustom.required = false;
      categoryCustom.value = '';
    }
  });
}
// 收入分类自定义
if (incomeCategorySelect && categoryCustom) {
  incomeCategorySelect.addEventListener('change', function() {
    if (incomeCategorySelect.value === '自定义') {
      categoryCustom.classList.remove('hidden');
      categoryCustom.required = true;
      categoryCustom.focus();
    } else {
      categoryCustom.classList.add('hidden');
      categoryCustom.required = false;
      categoryCustom.value = '';
    }
  });
}

form.addEventListener('submit', async function(e) {
  e.preventDefault();
  const formData = new FormData(form);
  let category = '';
  if (typeSelect.value === '收入') {
    category = formData.get('income-category');
    if (category === '自定义') category = formData.get('category-custom');
  } else {
    category = formData.get('expense-category');
    if (category === '自定义') category = formData.get('category-custom');
  }
  const record = {
    date: formData.get('date'),
    type: formData.get('type'),
    amount: formData.get('amount'),
    department: formData.get('department'),
    category: category,
    project: formData.get('project'),
    note: formData.get('note')
  };
  records.push(record);
  saveRecords(records);
  refreshAll();
  form.reset();
  // 重置分类自定义输入隐藏
  if (categoryCustom) {
    categoryCustom.classList.add('hidden');
    categoryCustom.required = false;
  }
  updateCategorySelect();
});

// 页面初始化
refreshAll();

// 中英文文本映射
const i18n = {
  zh: {
    title: '公司级多部门记账分析系统',
    add: '添加记录',
    date: '日期',
    type: '类型',
    amount: '金额',
    department: '所属部门',
    category: '分类',
    project: '项目名称（可选）',
    note: '备注',
    income: '收入',
    expense: '支出',
    totalIncome: '本月总收入',
    totalExpense: '本月总支出',
    netProfit: '本月净利润',
    expensePie: '本月各部门支出占比',
    incomePie: '本月各部门收入占比',
    bar: '部门收支对比（收入/支出/净利润）',
    table: '记账记录',
    dep1: '产品设计',
    dep2: '数字人流量',
    dep3: '博彩',
    legend: ['产品设计', '数字人流量', '博彩'],
    expenseCats: ['办公', '广告', '平台费', '项目支出', '自定义...'],
    incomeCats: ['用户付费', '直播带货服务', '量化投注', '自定义...'],
    customPlaceholder: '请输入自定义分类',
    projectPlaceholder: '如：C罗数字人直播',
    notePlaceholder: '备注信息',
    langBtn: 'English'
  },
  en: {
    title: 'Company Multi-Department Accounting System',
    add: 'Add Record',
    date: 'Date',
    type: 'Type',
    amount: 'Amount',
    department: 'Department',
    category: 'Category',
    project: 'Project (Optional)',
    note: 'Note',
    income: 'Income',
    expense: 'Expense',
    totalIncome: 'Total Income (Month)',
    totalExpense: 'Total Expense (Month)',
    netProfit: 'Net Profit (Month)',
    expensePie: 'Department Expense Ratio (Month)',
    incomePie: 'Department Income Ratio (Month)',
    bar: 'Department Finance (Income / Expense / Profit)',
    table: 'Records',
    dep1: 'Product Design',
    dep2: 'Digital Traffic',
    dep3: 'Betting',
    legend: ['Product Design', 'Digital Traffic', 'Betting'],
    expenseCats: ['Office', 'Advertising', 'Platform Fee', 'Project Expense', 'Custom...'],
    incomeCats: ['User Payment', 'Live Commerce', 'Quantitative Betting', 'Custom...'],
    customPlaceholder: 'Custom category',
    projectPlaceholder: 'e.g. Ronaldo Live',
    notePlaceholder: 'Note',
    langBtn: '中文'
  }
};
let lang = 'zh';

function setLang(l) {
  lang = l;
  const t = i18n[lang];
  document.getElementById('title-main').textContent = t.title;
  document.getElementById('btn-add').textContent = t.add;
  document.getElementById('label-date').textContent = t.date;
  document.getElementById('label-type').textContent = t.type;
  document.getElementById('label-amount').textContent = t.amount;
  document.getElementById('label-department').textContent = t.department;
  document.getElementById('label-category').textContent = t.category;
  document.getElementById('label-project').textContent = t.project;
  document.getElementById('label-note').textContent = t.note;
  document.getElementById('card-income-label').textContent = t.totalIncome;
  document.getElementById('card-expense-label').textContent = t.totalExpense;
  document.getElementById('card-profit-label').textContent = t.netProfit;
  document.getElementById('expense-pie-title').textContent = t.expensePie;
  document.getElementById('income-pie-title').textContent = t.incomePie;
  document.getElementById('bar-title').textContent = t.bar;
  document.getElementById('table-title').textContent = t.table;
  document.getElementById('th-date').textContent = t.date;
  document.getElementById('th-type').textContent = t.type;
  document.getElementById('th-amount').textContent = t.amount;
  document.getElementById('th-department').textContent = t.department;
  document.getElementById('th-category').textContent = t.category;
  document.getElementById('th-project').textContent = t.project;
  document.getElementById('th-note').textContent = t.note;
  document.getElementById('th-action').textContent = '';
  // 图例
  document.getElementById('legend-dep1').textContent = t.dep1;
  document.getElementById('legend-dep2').textContent = t.dep2;
  document.getElementById('legend-dep3').textContent = t.dep3;
  document.getElementById('legend2-dep1').textContent = t.dep1;
  document.getElementById('legend2-dep2').textContent = t.dep2;
  document.getElementById('legend2-dep3').textContent = t.dep3;
  document.getElementById('legend3-dep1').textContent = t.dep1;
  document.getElementById('legend3-dep2').textContent = t.dep2;
  document.getElementById('legend3-dep3').textContent = t.dep3;
  // 分类下拉
  if (expenseCategorySelect) {
    expenseCategorySelect.innerHTML = '';
    t.expenseCats.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.replace('...', '');
      opt.textContent = cat;
      expenseCategorySelect.appendChild(opt);
    });
  }
  if (incomeCategorySelect) {
    incomeCategorySelect.innerHTML = '';
    t.incomeCats.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.replace('...', '');
      opt.textContent = cat;
      incomeCategorySelect.appendChild(opt);
    });
  }
  if (categoryCustom) categoryCustom.placeholder = t.customPlaceholder;
  document.getElementById('project').placeholder = t.projectPlaceholder;
  document.getElementById('note').placeholder = t.notePlaceholder;
  // 切换按钮
  document.getElementById('lang-toggle').textContent = t.langBtn;
  // 切换语言后刷新所有图表，确保字体清晰
  refreshAll();
}

document.getElementById('lang-toggle').addEventListener('click', function() {
  setLang(lang === 'zh' ? 'en' : 'zh');
});
setLang('zh'); 