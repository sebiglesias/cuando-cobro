// Calendario Oficial de Pagos ANSES - Logic & Engine
(function() {
  'use strict';

  // Argentine national holidays for 2025-2027 (standardized)
  const HOLIDAYS = {
    '2026-01-01': 'Año Nuevo',
    '2026-02-16': 'Carnaval',
    '2026-02-17': 'Carnaval',
    '2026-03-24': 'Memoria Verdad y Justicia',
    '2026-04-02': 'Veteranos y Caídos en Malvinas',
    '2026-04-03': 'Viernes Santo',
    '2026-05-01': 'Día del Trabajador',
    '2026-05-25': 'Revolución de Mayo',
    '2026-06-15': 'Paso a la Inmortalidad de Güemes (trasladado)',
    '2026-06-20': 'Paso a la Inmortalidad de Belgrano',
    '2026-07-09': 'Día de la Independencia',
    '2026-07-10': 'Feriado Puente',
    '2026-08-17': 'Paso a la Inmortalidad de San Martín',
    '2026-10-12': 'Diversidad Cultural',
    '2026-11-20': 'Soberanía Nacional',
    '2026-11-23': 'Feriado Puente',
    '2026-12-08': 'Inmaculada Concepción',
    '2026-12-25': 'Navidad'
  };

  const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const DAY_NAMES = [
    'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
  ];

  const BENEFITS = {
    'jub-min': {
      name: 'Jubilaciones y Pensiones (Haber Mínimo)',
      short: 'Jubilación Mínima',
      desc: 'Incluye bono extraordinario previsional y medio aguinaldo (en junio y diciembre).',
      refAmount: '$345.000 (aprox. haber + bono)',
      type: 'sequential-start-8' // Starts around 8th-9th business day
    },
    'jub-max': {
      name: 'Jubilaciones y Pensiones (Superen el Haber Mínimo)',
      short: 'Jubilación Superior al Mínimo',
      desc: 'Haberes que superan la jubilación mínima oficial fijada por ANSES.',
      refAmount: 'Variable según liquidación personal',
      type: 'paired-late' // Starts around 23rd-24th
    },
    'auh': {
      name: 'Asignación Universal por Hijo (AUH) y Embarazo',
      short: 'AUH y Embarazo',
      desc: 'Cobro del 80% mensual de la asignación + acreditación simultánea de Tarjeta Alimentar.',
      refAmount: 'AUH + Tarjeta Alimentar según hijos',
      type: 'sequential-start-8'
    },
    'suaf': {
      name: 'Asignaciones Familiares SUAF (Trabajadores en blanco)',
      short: 'SUAF',
      desc: 'Asignación por hijo para empleados en relación de dependencia y monotributistas.',
      refAmount: 'Según escala de ingresos del grupo familiar',
      type: 'sequential-start-8'
    },
    'pnc': {
      name: 'Pensiones No Contributivas (PNC)',
      short: 'PNC (Invalidez / Madre 7 Hijos / Vejez)',
      desc: 'Se abonan los primeros días hábiles del mes.',
      refAmount: '70% del haber mínimo + bono',
      type: 'paired-early' // First business days
    },
    'desempleo': {
      name: 'Prestación por Desempleo (Plan 1)',
      short: 'Fondo de Desempleo',
      desc: 'Cuota mensual para trabajadores despedidos sin justa causa.',
      refAmount: 'Entre 50% y 100% del SMVM',
      type: 'paired-late'
    }
  };

  // State
  let currentBenefit = 'jub-min';
  let currentDni = 0;
  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth(); // 0-indexed

  // Helper: check if date is business day
  function isBusinessDay(d) {
    const day = d.getDay();
    if (day === 0 || day === 6) return false;
    const iso = d.toISOString().split('T')[0];
    if (HOLIDAYS[iso]) return false;
    return true;
  }

  // Get list of business days in given month
  function getBusinessDaysInMonth(year, month) {
    const list = [];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      if (isBusinessDay(d)) {
        list.push(d);
      }
    }
    return list;
  }

  // Generate calendar dates for all 10 DNI endings (0..9)
  function calculateSchedule(benefitId, year, month) {
    const bDays = getBusinessDaysInMonth(year, month);
    const benefit = BENEFITS[benefitId];
    const schedule = {}; // dni -> Date object

    if (benefit.type === 'paired-early') {
      // PNC: First 5 business days, 2 terminations per day:
      // 0 y 1: day 0; 2 y 3: day 1; 4 y 5: day 2; 6 y 7: day 3; 8 y 9: day 4
      const pairs = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9]];
      pairs.forEach((pair, idx) => {
        const date = bDays[Math.min(idx, bDays.length - 1)];
        pair.forEach(dni => {
          schedule[dni] = date;
        });
      });
    } else if (benefit.type === 'sequential-start-8') {
      // Starts approx on the 6th or 7th business day of the month (which falls around the 8th-10th of calendar month)
      // DNI 0 to 9, one per business day
      const startIndex = Math.min(5, Math.max(0, bDays.length - 10));
      for (let i = 0; i <= 9; i++) {
        const date = bDays[Math.min(startIndex + i, bDays.length - 1)];
        schedule[i] = date;
      }
    } else if (benefit.type === 'paired-late') {
      // 5 business days near the end of month
      // 0 y 1, 2 y 3, 4 y 5, 6 y 7, 8 y 9
      const pairs = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9]];
      const startIndex = Math.max(0, bDays.length - 5);
      pairs.forEach((pair, idx) => {
        const date = bDays[Math.min(startIndex + idx, bDays.length - 1)];
        pair.forEach(dni => {
          schedule[dni] = date;
        });
      });
    }

    return schedule;
  }

  // Formatting date string: "Miércoles 12 de Noviembre de 2026"
  function formatDateLong(date) {
    const dayName = DAY_NAMES[date.getDay()];
    const dayNum = date.getDate();
    const monthName = MONTH_NAMES[date.getMonth()];
    const year = date.getFullYear();
    return `${dayName} ${dayNum} de ${monthName} de ${year}`;
  }

  function formatDateShort(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
  }

  // Render main result and table
  function render() {
    const schedule = calculateSchedule(currentBenefit, currentYear, currentMonth);
    const targetDate = schedule[currentDni];
    const benefit = BENEFITS[currentBenefit];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkDate = new Date(targetDate);
    checkDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((checkDate - today) / (1000 * 60 * 60 * 24));

    // Elements
    const heroDateEl = document.getElementById('hero-date');
    const heroTagEl = document.getElementById('hero-tag');
    const heroCountdownEl = document.getElementById('hero-countdown');
    const heroBenefitEl = document.getElementById('hero-benefit-name');
    const heroRefEl = document.getElementById('hero-ref-amount');
    const heroDniEl = document.getElementById('hero-dni');
    const calBtn = document.getElementById('btn-add-calendar');

    heroBenefitEl.textContent = benefit.name;
    heroDniEl.textContent = `Terminación ${currentDni}`;
    heroRefEl.textContent = benefit.refAmount;
    heroDateEl.textContent = formatDateLong(targetDate);

    // Status logic
    heroTagEl.className = 'result-tag';
    if (diffDays === 0) {
      heroTagEl.classList.add('status-today');
      heroTagEl.textContent = '🟢 ¡COBRAS HOY!';
      heroCountdownEl.textContent = 'Los fondos están disponibles en tu cuenta bancaria o cajero desde las primeras horas de hoy.';
    } else if (diffDays === 1) {
      heroTagEl.classList.add('status-future');
      heroTagEl.textContent = '⏳ COBRAS MAÑANA';
      heroCountdownEl.textContent = 'Falta solo 1 día para la acreditación oficial de ANSES.';
    } else if (diffDays > 1) {
      heroTagEl.classList.add('status-future');
      heroTagEl.textContent = `⏳ EN ${diffDays} DÍAS`;
      heroCountdownEl.textContent = `Faltan ${diffDays} días para tu fecha de cobro oficial.`;
    } else if (diffDays === -1) {
      heroTagEl.classList.add('status-past');
      heroTagEl.textContent = '✓ COBRADO AYER';
      heroCountdownEl.textContent = 'Se acreditó ayer. Tu haber ya se encuentra depositado y disponible para retiro.';
    } else {
      heroTagEl.classList.add('status-past');
      heroTagEl.textContent = `✓ COBRADO HACE ${Math.abs(diffDays)} DÍAS`;
      heroCountdownEl.textContent = `Fecha vencida. El dinero ya debería estar acreditado en tu CBU/tarjeta de débito.`;
    }

    // Google Calendar Link generator
    const isoDateStr = targetDate.toISOString().split('T')[0].replace(/-/g, '');
    const calTitle = encodeURIComponent(`Cobro ANSES - ${benefit.short} (DNI ${currentDni})`);
    const calDetails = encodeURIComponent(`Fecha oficial de cobro ANSES para ${benefit.name} (DNI terminado en ${currentDni}). Consultá en https://sebiglesias.com.ar/cuando-cobro/`);
    calBtn.href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calTitle}&dates=${isoDateStr}T110000Z/${isoDateStr}T120000Z&details=${calDetails}`;

    // Render Full Schedule Table
    const tableBody = document.getElementById('schedule-table-body');
    tableBody.innerHTML = '';

    for (let d = 0; d <= 9; d++) {
      const dDate = schedule[d];
      const dCheck = new Date(dDate);
      dCheck.setHours(0, 0, 0, 0);
      const dDiff = Math.round((dCheck - today) / (1000 * 60 * 60 * 24));

      let badgeHtml = '';
      if (dDiff === 0) {
        badgeHtml = '<span class="status-badge today">Hoy</span>';
      } else if (dDiff > 0) {
        badgeHtml = `<span class="status-badge future">En ${dDiff} d</span>`;
      } else {
        badgeHtml = '<span class="status-badge past">Acreditado</span>';
      }

      const tr = document.createElement('tr');
      if (d === currentDni) {
        tr.classList.add('highlighted');
      }
      tr.innerHTML = `
        <td><strong>Terminación ${d}</strong></td>
        <td>${formatDateLong(dDate)}</td>
        <td>${badgeHtml}</td>
      `;
      tr.addEventListener('click', () => {
        selectDni(d);
      });
      tr.style.cursor = 'pointer';
      tableBody.appendChild(tr);
    }
  }

  function selectDni(dni) {
    currentDni = parseInt(dni, 10);
    localStorage.setItem('cuando_cobro_dni', currentDni);
    document.querySelectorAll('.dni-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.dni, 10) === currentDni);
    });
    render();
  }

  // Init UI listeners
  function init() {
    // Restore saved
    const savedDni = localStorage.getItem('cuando_cobro_dni');
    if (savedDni !== null) {
      currentDni = parseInt(savedDni, 10);
    }
    const savedBenefit = localStorage.getItem('cuando_cobro_benefit');
    if (savedBenefit && BENEFITS[savedBenefit]) {
      currentBenefit = savedBenefit;
    }

    // Populate month selector
    const monthSelect = document.getElementById('select-month');
    const now = new Date();
    // Offer current month, previous month, and next month
    const months = [
      { y: now.getFullYear(), m: now.getMonth() - 1, label: 'Mes anterior' },
      { y: now.getFullYear(), m: now.getMonth(), label: 'Mes actual' },
      { y: now.getFullYear(), m: now.getMonth() + 1, label: 'Próximo mes' }
    ];

    months.forEach((item, idx) => {
      let adjYear = item.y;
      let adjMonth = item.m;
      if (adjMonth < 0) {
        adjMonth = 11;
        adjYear -= 1;
      } else if (adjMonth > 11) {
        adjMonth = 0;
        adjYear += 1;
      }
      const opt = document.createElement('option');
      opt.value = `${adjYear}-${adjMonth}`;
      opt.textContent = `${MONTH_NAMES[adjMonth]} ${adjYear} ${idx === 1 ? '(Actual)' : ''}`;
      if (idx === 1) opt.selected = true;
      monthSelect.appendChild(opt);
    });

    monthSelect.addEventListener('change', (e) => {
      const [y, m] = e.target.value.split('-').map(Number);
      currentYear = y;
      currentMonth = m;
      render();
    });

    // Benefit select
    const benefitSelect = document.getElementById('select-benefit');
    benefitSelect.value = currentBenefit;
    benefitSelect.addEventListener('change', (e) => {
      currentBenefit = e.target.value;
      localStorage.setItem('cuando_cobro_benefit', currentBenefit);
      render();
    });

    // DNI keypad
    document.querySelectorAll('.dni-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectDni(btn.dataset.dni);
      });
      if (parseInt(btn.dataset.dni, 10) === currentDni) {
        btn.classList.add('active');
      }
    });

    // FAQ Accordion
    document.querySelectorAll('.faq-question').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.parentElement;
        item.classList.toggle('open');
      });
    });

    // Initial render
    render();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
