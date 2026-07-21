const API = {
    KL: 'https://user-game-history.kalambagames.com/rounds/',
    FD: 'https://user-game-history.flatdoggames.com/rounds/'
};
  
const STATS_API = {
    KL: 'https://user-game-history.kalambagames.com/rounds',
    FD: 'https://user-game-history.flatdoggames.com/rounds'
};
  
function getDayRangeUTCplus2(isoString) {
    const OFFSET_MS = 2 * 60 * 60 * 1000;
    const shifted = new Date(new Date(isoString).getTime() + OFFSET_MS);
    const y = shifted.getUTCFullYear();
    const m = shifted.getUTCMonth();
    const d = shifted.getUTCDate();
    const from = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - OFFSET_MS);
    const to = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - OFFSET_MS);

    return { from: from.toISOString(), to: to.toISOString() };
}
  
function buildStatsUrl(provider, { gameCode, operatorCode, username, roundStartTime }) {
    const { from, to } = getDayRangeUTCplus2(roundStartTime);
    const params = new URLSearchParams({
        gameCode,
        limit: 200,
        operatorCode,
        page: 0,
        username,
        fromDateTime: from,
        toDateTime: to
    });
    
    return `${STATS_API[provider]}?${params.toString()}`;
}
  
const FRONTEND_DOMAIN = {
    KL: 'https://user-game-history.kalambagames.com/frontend/index.html',
    FD: 'https://user-game-history.flatdoggames.com/frontend/index.html'
};
  
const GRAFANA_BASE = 'https://dwstats.kalambagames.com/d/eae273e2-f3b8-4999-afdc-1666349014d1/player-win-verification?orgId=1&var-userId=';
  
function kibanaLogsUrl(roundId) {
    const query = `cycleId: "${roundId}"`;

    return `https://kibana-logs.kalambagames.com/app/discover#/?_g=(filters:!(),refreshInterval:(pause:!t,value:60000),time:(from:now-14d,to:now))&_a=(columns:!(),dataSource:(dataViewId:ac4e0df0-0cd4-11ed-b84c-07b0ed9c34c0,type:dataView),filters:!(),interval:auto,query:(language:kuery,query:'${encodeURIComponent(query).replace(/%20/g, '%20')}'),sort:!(!('@timestamp',desc)))&_tab=(tabId:'48272e3d-d8d8-4413-bb0f-f22f1ffce26c')`;
}
  
function kibanaRoundsUrl(roundId) {
    const query = `roundId: "${roundId}"`;

    return `https://rounds.kalambagames.com/app/discover#/?_g=(filters:!(),refreshInterval:(pause:!t,value:1000),time:(from:now-6M,to:now))&_a=(columns:!(),dataSource:(dataViewId:'9e2cf0c0-7868-11ec-8c98-a5ab031ce4f6',type:dataView),filters:!(),interval:auto,query:(language:kuery,query:'${encodeURIComponent(query).replace(/%20/g, '%20')}'),sort:!(!(creationTime,desc)))&_tab=(tabId:'9535b9f0-dda6-4ecb-9b38-11b7be84c763')`;
}
  
function detectProvider(roundId) {
    const upper = roundId.toUpperCase();

    if (upper.startsWith('KL')) return 'KL';
    if (upper.startsWith('FD')) return 'FD';

    return null;
}
  
let currentStatsUrl = null;
let currentRoundBetAmount = null;
let currentRoundId = null;
  
function setStatus(message, type) {
    const box = document.getElementById('statusBox');
    const colors = { info: 'text-info', error: 'text-danger', success: 'text-success' };
    box.className = 'mt-2 small ' + (colors[type] || 'text-secondary');
    box.textContent = message;
}
  
async function checkRound() {
    const roundId = document.getElementById('roundIdInput').value.trim();
    document.getElementById('resultCard').classList.add('d-none');
    document.getElementById('actionButtons').classList.add('d-none');
    document.getElementById('kibanaNote').classList.add('d-none');
  
    if (!roundId) {
      setStatus('Provide the Round ID.', 'error');

      return;
    }
  
    const provider = detectProvider(roundId);
    if (!provider) {
      setStatus('Provider not recognized — Round ID must start with "KL" or "FD".', 'error');

      return;
    }
  
    setStatus(`Gathering the round details (${provider})...`, 'info');
    document.getElementById('checkBtn').disabled = true;
  
    try {
        const res = await fetch(API[provider] + encodeURIComponent(roundId));
        if (!res.ok) {
            throw new Error(`API replied ${res.status}`);
        }
        const data = await res.json();
  
        const entry = data?.content?.[0];
        if (!entry) {
            throw new Error('No data for provided Round ID (check if it exists and is not too old).');
        }
  
        const details = entry.roundDetails || {};
        const username = details.userId || '';
        const gameCode = details.gameCode || '';
        const operatorCode = username.includes('_') ? username.split('_').pop() : '';
  
        if (!username || !gameCode) {
            throw new Error('The API response is missing required fields (userId or gameCode).');
        }
  
        const currency = details.currency || '';
        const betAmount = details.betAmount;
        const winAmount = details.winAmount;
        const afterBet = details.afterBetBalanceAmount;
        const afterWin = details.afterWinBalanceAmount;
        
        currentRoundBetAmount = betAmount;
        currentRoundId = roundId;
  
        document.getElementById('infoRoundId').textContent = roundId;
        document.getElementById('infoUsername').textContent = username;
        document.getElementById('infoOperatorCode').textContent = operatorCode || '(n/a)';
        document.getElementById('infoGameCode').textContent = gameCode;
        document.getElementById('infoJurisdiction').textContent = details.configurationJurisdiction || '(n/a)';
        document.getElementById('infoCageCode').textContent = details.cageCode || '(n/a)';
        document.getElementById('infoGameModel').textContent = details.gameModel || '(n/a)';
        document.getElementById('infoBetAmount').textContent = (betAmount !== undefined) ? `${currency} ${betAmount}` : '(n/a)';
        document.getElementById('infoWinAmount').textContent = (winAmount !== undefined) ? `${currency} ${winAmount}` : '(n/a)';
  
        const balanceCheckEl = document.getElementById('infoBalanceCheck');
        if (afterBet !== undefined && afterWin !== undefined && winAmount !== undefined) {
            const diff = afterWin - afterBet;
            const isCorrect = Math.abs(diff - winAmount) < 0.01;
            balanceCheckEl.textContent = isCorrect
            ? `✅ CORRECT (${diff.toFixed(2)})`
            : `❌ MISMATCH (calculated ${diff.toFixed(2)}, expected ${winAmount})`;
        } else {
            balanceCheckEl.textContent = '(No data available for verification)';
        }
  
        const badge = document.getElementById('providerBadge');
        badge.textContent = provider;
        badge.className = 'badge ms-2 ' + (provider === 'KL' ? 'badge-kl' : 'badge-fd');
  
        document.getElementById('resultCard').classList.remove('d-none');
  
        const historyUrl = `${FRONTEND_DOMAIN[provider]}?operatorCode=${encodeURIComponent(operatorCode)}&username=${encodeURIComponent(username)}&gameCode=${encodeURIComponent(gameCode)}&page=1`;
        const replayUrl = `${FRONTEND_DOMAIN[provider]}?roundId=${encodeURIComponent(roundId)}`;
        const grafanaUrl = GRAFANA_BASE + encodeURIComponent(username);
  
        document.getElementById('btnHistory').href = historyUrl;
        document.getElementById('btnReplay').href = replayUrl;
        document.getElementById('btnGrafana').href = grafanaUrl;
        document.getElementById('btnKibanaLogs').href = kibanaLogsUrl(roundId);
        document.getElementById('btnKibanaRounds').href = kibanaRoundsUrl(roundId);
  
        const statsUrl = buildStatsUrl(provider, {
            gameCode,
            operatorCode,
            username,
            roundStartTime: details.roundStartTime
        });

        document.getElementById('btnStatsData').href = statsUrl;
        currentStatsUrl = statsUrl;
        
        document.getElementById('statsSection').classList.remove('d-none');
        document.getElementById('statsTable').classList.add('d-none');
        document.getElementById('statsStatus').textContent = '';
  
        document.getElementById('actionButtons').classList.remove('d-none');
        document.getElementById('kibanaNote').classList.remove('d-none');
  
        setStatus('Data retrieved successfully.', 'success');
        } catch (err) {
            console.error(err);
            setStatus('Błąd: ' + err.message + ' (Also, check whether the browser is blocking the request due to CORS).', 'error');
        } finally {
            document.getElementById('checkBtn').disabled = false;
        }
}
  
document.getElementById('checkBtn').addEventListener('click', checkRound);
document.getElementById('roundIdInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') checkRound();
});
  
function setStatsStatus(message) {
    document.getElementById('statsStatus').textContent = message;
}
  
async function fetchAllRounds(baseUrl) {
    const url0 = new URL(baseUrl);
    url0.searchParams.set('page', '0');
    const res0 = await fetch(url0.toString());
    if (!res0.ok) throw new Error(`API responded with status ${res0.status}`);

    const data0 = await res0.json();
    const totalPages = data0?.result?.totalPages || 1;
    const allRounds = [...(data0?.result?.content || [])];
  
    for (let p = 1; p < totalPages; p++) {
        setStatsStatus(`Pobieranie strony ${p + 1} z ${totalPages}...`);
        const u = new URL(baseUrl);
        
        u.searchParams.set('page', String(p));
        
        const res = await fetch(u.toString());
        if (!res.ok) throw new Error(`API responded with status ${res.status} (page ${p})`);
        const pageData = await res.json();
        allRounds.push(...(pageData?.result?.content || []));
    }
  
    return allRounds;
}

function computeStats(rounds) {
    const isBonusSpin = (r) => Array.isArray(r.winAmountSources) && r.winAmountSources.some(s => s.id === 'FREE_SPIN');
  
    const baseSpins = rounds.filter(r => !isBonusSpin(r));
    const bonusSpins = rounds.filter(isBonusSpin);
  
    const totalBet = rounds.reduce((sum, r) => sum + (r.betAmount || 0), 0);
    const avgBet = rounds.length > 0 ? totalBet / rounds.length : null;
    const baseWin = baseSpins.reduce((sum, r) => sum + (r.winAmount || 0), 0);
    const bonusWin = bonusSpins.reduce((sum, r) => sum + (r.winAmount || 0), 0);
    const totalWin = baseWin + bonusWin;
  
    const rtp = totalBet > 0 ? (totalWin / totalBet) * 100 : null;
    const baseRtp = totalBet > 0 ? (baseWin / totalBet) * 100 : null;
    const fsRtp = totalBet > 0 ? (bonusWin / totalBet) * 100 : null;
  
    const hits = baseSpins.filter(r => (r.winAmount || 0) > 0).length;
    const hitFrequency = baseSpins.length > 0 ? (hits / baseSpins.length) * 100 : null;
    const bonusFrequency = baseSpins.length > 0 ? (bonusSpins.length / baseSpins.length) * 100 : null;
  
    const allWins = rounds.map(r => r.winAmount || 0);
    const avg = allWins.length > 0 ? allWins.reduce((a, b) => a + b, 0) / allWins.length : null;
    let stdDev = null;
    
    if (allWins.length > 0 && avg !== null) {
        const variance = allWins.reduce((sum, w) => sum + Math.pow(w - avg, 2), 0) / allWins.length;
        stdDev = Math.sqrt(variance);
    }
  
    return {
        totalRounds: rounds.length,
        totalBet, totalWin, baseWin, bonusWin,
        rtp, baseRtp, fsRtp,
        hitFrequency, bonusFrequency,
        avg, stdDev, avgBet,
        currency: rounds[0]?.currency || ''
    };
}
  
const MULTIPLIER_BUCKETS = [
    { label: 'x 0.0', test: (m) => m === 0 },
    { label: 'x 0 - 1', test: (m) => m > 0 && m < 1 },
    { label: 'x 1 - 10', test: (m) => m >= 1 && m < 10 },
    { label: 'x 10 - 50', test: (m) => m >= 10 && m < 50 },
    { label: 'x 50 - 100', test: (m) => m >= 50 && m < 100 },
    { label: 'x 100 - 250', test: (m) => m >= 100 && m < 250 },
    { label: 'x 250 - 500', test: (m) => m >= 250 && m < 500 },
    { label: 'x 500+', test: (m) => m >= 500 }
];
  
function average(arr) {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}
  
function analyzeBetPattern(rounds, targetRoundId, overallAvgBet) {
    const sorted = [...rounds].sort((a, b) => new Date(a.roundStartTime) - new Date(b.roundStartTime));
    const index = sorted.findIndex(r => r.roundId === targetRoundId);
  
    if (index === -1) {
      return ['This round was not found in the analyzed day\'s data (it may be outside the fetched date range).'];
    }
  
    const target = sorted[index];
    const targetBet = target.betAmount || 0;
    const messages = [];
  
    if (overallAvgBet && overallAvgBet > 0) {
        const diffPct = ((targetBet - overallAvgBet) / overallAvgBet) * 100;
        messages.push(targetBet > overallAvgBet
            ? `1) Unusually high bet? Yes — this round's bet was ${diffPct.toFixed(1)}% higher than the day's average bet.`
            : `1) Unusually high bet? No — this round's bet was ${Math.abs(diffPct).toFixed(1)}% lower than (or equal to) the day's average bet.`);
    } else {
        messages.push('1) Unusually high bet? Not enough data to check.');
    }
  
    const before = sorted.slice(Math.max(0, index - 20), index);
    if (before.length === 0) {
        messages.push('2) Sudden bet increase before the win? This was the first round of the day, nothing to compare.');
    } else if (overallAvgBet && overallAvgBet > 0) {
        const beforeAvgBet = average(before.map(r => r.betAmount || 0));
        const diffPct = ((beforeAvgBet - overallAvgBet) / overallAvgBet) * 100;
        messages.push(beforeAvgBet > overallAvgBet
            ? `2) Sudden bet increase before the win? Yes — the ${before.length} round(s) right before the win had an average bet ${diffPct.toFixed(1)}% higher than the day's average.`
            : `2) Sudden bet increase before the win? No — the ${before.length} round(s) right before the win had a normal or lower average bet (${diffPct.toFixed(1)}% vs day's average).`);
    } else {
        messages.push('2) Sudden bet increase before the win? Not enough data to check.');
    }
  
    const after = sorted.slice(index + 1, index + 21);
    if (after.length === 0) {
        messages.push('3) Back to small bets after the win? This was the last round of that day, nothing to compare.');
    } else if (overallAvgBet && overallAvgBet > 0) {
        const afterAvgBet = average(after.map(r => r.betAmount || 0));
        const diffPct = ((afterAvgBet - overallAvgBet) / overallAvgBet) * 100;
        messages.push(afterAvgBet < overallAvgBet
            ? `3) Back to small bets after the win? Yes — the ${after.length} round(s) after the win had an average bet ${Math.abs(diffPct).toFixed(1)}% lower than the day's average.`
            : `3) Back to small bets after the win? No — the ${after.length} round(s) after the win had a normal or higher average bet (${diffPct.toFixed(1)}% vs day's average).`);
    } else {
        messages.push('3) Back to small bets after the win? Not enough data to check.');
    }
  
    if (overallAvgBet && overallAvgBet > 0) {
        const highBetThreshold = overallAvgBet * 1.5; // "high bet" = at least 50% above the day's average
        const highBetIndexes = sorted
            .map((r, i) => ({ i, bet: r.betAmount || 0 }))
            .filter(x => x.bet > highBetThreshold)
            .map(x => x.i);
  
      if (highBetIndexes.length === 0) {
        messages.push('4) High bets clustered around the win? There were no notably high bets that day.');
      } else {
            const windowStart = Math.max(0, index - 20);
            const windowEnd = Math.min(sorted.length - 1, index + 20);
            const inWindow = highBetIndexes.filter(i => i >= windowStart && i <= windowEnd).length;
            const outWindow = highBetIndexes.length - inWindow;
            const pctInWindow = (inWindow / highBetIndexes.length) * 100;
    
            messages.push(outWindow === 0
            ? `4) High bets clustered around the win? Yes — all ${highBetIndexes.length} high-bet round(s) that day happened within 20 rounds of this win.`
            : `4) High bets clustered around the win? Partly — ${pctInWindow.toFixed(0)}% of the ${highBetIndexes.length} high-bet round(s) that day were near this win, and ${outWindow} happened elsewhere.`);
        }
    } else {
        messages.push('4) High bets clustered around the win? Not enough data to check.');
    }
  
    return messages;
  }

function computeMultiplierBuckets(rounds) {
    const counts = MULTIPLIER_BUCKETS.map(() => 0);
    rounds.forEach(r => {
        const bet = r.betAmount || 0;
        const win = r.winAmount || 0;
        const multiplier = bet > 0 ? win / bet : 0;
        const idx = MULTIPLIER_BUCKETS.findIndex(b => b.test(multiplier));
        if (idx !== -1) counts[idx]++;
    });
    
    return MULTIPLIER_BUCKETS.map((b, i) => ({ label: b.label, count: counts[i] }));
}
  
function fmtPct(v) { return v === null ? '(no data)' : `${v.toFixed(2)}%`; }
function fmtAmt(v, currency) { return v === null ? '(no data)' : `${currency} ${v.toFixed(2)}`; }
  
let timelineChartInstance = null;

function pickBucketMinutes(durationMinutes) {
    if (durationMinutes <= 10) return 0.5;   
    if (durationMinutes <= 20) return 1;
    if (durationMinutes <= 40) return 2;
    if (durationMinutes <= 60) return 3;
    if (durationMinutes <= 90) return 5;
    if (durationMinutes <= 200) return 10;
    if (durationMinutes <= 400) return 20;
    if (durationMinutes <= 800) return 40;
    if (durationMinutes <= 1200) return 60;
    return 120; 
}

function bucketRoundsByTime(rounds, bucketMinutes = 1) {
    const bucketMs = bucketMinutes * 60 * 1000;
    const buckets = new Map();
  
    rounds.forEach(r => {
        const t = new Date(r.roundStartTime).getTime();
        const bucketStart = Math.floor(t / bucketMs) * bucketMs;
        if (!buckets.has(bucketStart)) {
        buckets.set(bucketStart, { bet: 0, win: 0, count: 0 });
        }
        const b = buckets.get(bucketStart);
        b.bet += r.betAmount || 0;
        b.win += r.winAmount || 0;
        b.count += 1;
    });
  
    return [...buckets.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([ts, data]) => ({ time: new Date(ts), ...data }));
}
  
function renderTimelineChart(rounds) {
    const sortedTimes = rounds
        .map(r => new Date(r.roundStartTime).getTime())
        .sort((a, b) => a - b);

    const durationMinutes = sortedTimes.length > 1
        ? (sortedTimes[sortedTimes.length - 1] - sortedTimes[0]) / 60000
        : 0;

        const bucketMinutes = pickBucketMinutes(durationMinutes);
        const bucketed = bucketRoundsByTime(rounds, bucketMinutes);
        
        const betData = bucketed.map(b => b.bet);
        const winData = bucketed.map(b => b.win);
        
        const labels = bucketed.map(b =>
        bucketMinutes < 1
            ? b.time.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : b.time.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
        );
        
    const ctx = document.getElementById('timelineChart').getContext('2d');
  
    if (timelineChartInstance) {
      timelineChartInstance.destroy();
    }
  
    timelineChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
            {
                label: 'Bet Amount (sum / min)',
                data: betData,
                backgroundColor: 'rgba(0, 94, 255, 0.6)'
            },
            {
                label: 'Win Amount (sum / min)',
                data: winData,
                backgroundColor: 'rgba(255, 0, 0, 0.6)'
            }
            ]
        },
        options: {
            responsive: true,
            interaction: { mode: 'index', intersect: false },
            scales: {
            x: { ticks: { maxTicksLimit: 30, autoSkip: true } },
            y: { beginAtZero: true }
            }
        }
    });
}
  
async function calculateStatistics() {
    if (!currentStatsUrl) return;
    const btn = document.getElementById('statsBtn');
    btn.disabled = true;
    document.getElementById('statsTable').classList.add('d-none');
    setStatsStatus('Pobieranie danych...');
  
    try {
        const rounds = await fetchAllRounds(currentStatsUrl);
        renderTimelineChart(rounds);
        setStatsStatus(`Counting stats from ${rounds.length} rounds...`);
        const s = computeStats(rounds);

        const patternMessages = analyzeBetPattern(rounds, currentRoundId, s.avgBet);
        const patternList = document.getElementById('betPatternList');
        patternList.innerHTML = '';
        patternMessages.forEach(msg => {
        const li = document.createElement('li');
        li.textContent = msg;
        patternList.appendChild(li);
    });
  
        const diff = (currentRoundBetAmount !== null && s.avgBet !== null) ? currentRoundBetAmount - s.avgBet : null;
        document.getElementById('statAvgBet').textContent = fmtAmt(s.avgBet, s.currency);
        document.getElementById('statBetDiff').textContent = diff === null ? '(no data)' : `${diff >= 0 ? '+' : ''}${diff.toFixed(2)} ${s.currency} (bet amount: ${currentRoundBetAmount}, avg bet amount.: ${s.avgBet.toFixed(2)})`;
    
        document.getElementById('statTotalRounds').textContent = s.totalRounds;
        document.getElementById('statTotalBet').textContent = fmtAmt(s.totalBet, s.currency);
        document.getElementById('statTotalWin').textContent = fmtAmt(s.totalWin, s.currency);
        document.getElementById('statBaseWin').textContent = fmtAmt(s.baseWin, s.currency);
        document.getElementById('statFSWin').textContent = fmtAmt(s.bonusWin, s.currency);
        document.getElementById('statRTP').textContent = fmtPct(s.rtp);
        document.getElementById('statBaseRTP').textContent = fmtPct(s.baseRtp);
        document.getElementById('statFSRTP').textContent = fmtPct(s.fsRtp);
        document.getElementById('statHitFreq').textContent = fmtPct(s.hitFrequency);
        document.getElementById('statBonusFreq').textContent = fmtPct(s.bonusFrequency);
        document.getElementById('statAvgWin').textContent = fmtAmt(s.avg, s.currency);
        document.getElementById('statStdDev').textContent = fmtAmt(s.stdDev, s.currency);
  
        document.getElementById('statsTable').classList.remove('d-none');
  
        const buckets = computeMultiplierBuckets(rounds);
        const tbody = document.getElementById('multiplierTableBody');
        tbody.innerHTML = '';
        buckets.forEach(b => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${b.label}</td><td>${b.count}</td>`;
            tbody.appendChild(tr);
        });
        document.getElementById('multiplierTable').classList.remove('d-none');
  
        setStatsStatus(`Ready — ${rounds.length} have been analyzed.`);
        } catch (err) {
            console.error(err);
            setStatsStatus('Error: ' + err.message + ' (also check the CORS).');
        } finally {
            btn.disabled = false;
        }
}
  
document.getElementById('statsBtn').addEventListener('click', calculateStatistics);