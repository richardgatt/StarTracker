/**
 * GLOBAL STATE & INDEXED DB LOCAL STORAGE
 */
const DB_NAME = 'BasketballBoxScorePWA_DB_v2';
const DB_VERSION = 1;
let db = null;

// Active Game State
let currentGame = {
    id: 'game_' + Date.now(),
    date: new Date().toISOString(),
    status: 'IN_PROGRESS',
    trackingMode: 'SINGLE', // 'SINGLE' (My Team Only) or 'BOTH'
    myTeam: 'home',       // 'home' or 'away'
    showScoreboard: true,
    currentQuarter: 1,
    homeTeam: {
        name: "Home Warriors",
        color: "#f97316",
        scoreByQuarter: [0, 0, 0, 0],
        quarterFouls: [0, 0, 0, 0],
        timeoutsTaken: 0,
        roster: []
    },
    awayTeam: {
        name: "Away Titans",
        color: "#38bdf8",
        scoreByQuarter: [0, 0, 0, 0],
        quarterFouls: [0, 0, 0, 0],
        timeoutsTaken: 0,
        roster: []
    },
    events: [] // Play-by-play log with flagForDeletion state
};

let draggedPlayer = null; // { teamKey, playerId }

function initDefaultRosters() {
    currentGame.homeTeam.roster = [
        { id: 'h1', number: '30', name: 'Stephen C.', onCourt: true, stats: createEmptyStats() },
        { id: 'h2', number: '11', name: 'Klay T.', onCourt: true, stats: createEmptyStats() },
        { id: 'h3', number: '22', name: 'Andrew W.', onCourt: true, stats: createEmptyStats() },
        { id: 'h4', number: '23', name: 'Draymond G.', onCourt: true, stats: createEmptyStats() },
        { id: 'h5', number: '5', name: 'Kevon L.', onCourt: true, stats: createEmptyStats() },
        { id: 'h6', number: '0', name: 'Gary P.', onCourt: false, stats: createEmptyStats() },
        { id: 'h7', number: '00', name: 'Jonathan K.', onCourt: false, stats: createEmptyStats() }
    ];

    currentGame.awayTeam.roster = [
        { id: 'a1', number: '23', name: 'LeBron J.', onCourt: true, stats: createEmptyStats() },
        { id: 'a2', number: '3', name: 'Anthony D.', onCourt: true, stats: createEmptyStats() },
        { id: 'a3', number: '1', name: 'D\'Angelo R.', onCourt: true, stats: createEmptyStats() },
        { id: 'a4', number: '15', name: 'Austin R.', onCourt: true, stats: createEmptyStats() },
        { id: 'a5', number: '28', name: 'Rui H.', onCourt: true, stats: createEmptyStats() },
        { id: 'a6', number: '2', name: 'Jarred V.', onCourt: false, stats: createEmptyStats() }
    ];
}

function createEmptyStats() {
    return {
        pts: 0,
        fgm: 0, fga: 0,
        pm3: 0, pa3: 0,
        ftm: 0, fta: 0,
        offReb: 0, defReb: 0,
        ast: 0, stl: 0, blk: 0,
        to: 0, pf: 0
    };
}

function startDeviceClock() {
    const updateClock = () => {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        document.getElementById('realtimeClockDisplay').innerText = timeString;
    };
    updateClock();
    setInterval(updateClock, 1000);
}

function initDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            db = e.target.result;
            if (!db.objectStoreNames.contains('matches')) {
                db.createObjectStore('matches', { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };
        request.onerror = (e) => reject(e);
    });
}

async function saveCurrentGameToStorage() {
    localStorage.setItem('courtstats_pwa_v2_active', JSON.stringify(currentGame));
    if (db) {
        const tx = db.transaction('matches', 'readwrite');
        const store = tx.objectStore('matches');
        store.put(currentGame);
    }
}

async function loadGameFromStorage() {
    const saved = localStorage.getItem('courtstats_pwa_v2_active');
    if (saved) {
        try {
            currentGame = JSON.parse(saved);
            if (currentGame.showScoreboard === undefined) currentGame.showScoreboard = true;
            if (!currentGame.trackingMode) currentGame.trackingMode = 'SINGLE';
            if (!currentGame.myTeam) currentGame.myTeam = 'home';
            if (!currentGame.homeTeam.quarterFouls) currentGame.homeTeam.quarterFouls = [0,0,0,0];
            if (!currentGame.awayTeam.quarterFouls) currentGame.awayTeam.quarterFouls = [0,0,0,0];
            if (currentGame.homeTeam.timeoutsTaken === undefined) currentGame.homeTeam.timeoutsTaken = 0;
            if (currentGame.awayTeam.timeoutsTaken === undefined) currentGame.awayTeam.timeoutsTaken = 0;
        } catch (e) {
            initDefaultRosters();
        }
    } else {
        initDefaultRosters();
    }
    renderAllViews();
}

function updateOnlineStatus() {
    const isOnline = navigator.onLine;
    const badge = document.getElementById('offlineIndicator');
    const text = document.getElementById('connectionText');
    if (isOnline) {
        badge.className = "flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/50";
        text.innerText = "Online";
    } else {
        badge.className = "flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800/50";
        text.innerText = "Offline PWA";
    }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

/**
 * UI TABS & DASHBOARD TOGGLES
 */
function switchTab(tabKey) {
    document.querySelectorAll('.tab-view').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('border-orange-500', 'text-orange-400');
        btn.classList.add('border-transparent', 'text-slate-400');
    });

    document.getElementById(`view-${tabKey}`).classList.remove('hidden');
    const activeBtn = document.getElementById(`tab-${tabKey}`);
    activeBtn.classList.remove('border-transparent', 'text-slate-400');
    activeBtn.classList.add('border-orange-500', 'text-orange-400');

    if (tabKey === 'boxscore') {
        renderBoxScoreTables();
    } else if (tabKey === 'matches') {
        loadSavedMatchesList();
    }
}

function handleTrackingModeChange(isSingleTeam) {
    currentGame.trackingMode = isSingleTeam ? 'SINGLE' : 'BOTH';
    saveCurrentGameToStorage();
    renderAllViews();
}

function handleMyTeamChange(teamKey) {
    currentGame.myTeam = teamKey;
    saveCurrentGameToStorage();
    renderAllViews();
}

/**
 * TIMEOUT CALLING
 */
function callTimeout(teamKey) {
    const team = teamKey === 'home' ? currentGame.homeTeam : currentGame.awayTeam;
    team.timeoutsTaken = (team.timeoutsTaken || 0) + 1;
    logEvent(`Timeout called by ${team.name} (Total: ${team.timeoutsTaken})`, teamKey, null);
    renderScoreboard();
    saveCurrentGameToStorage();
}

/**
 * ADVANCE QUARTER WITH FLAGGED PURGE LOGIC
 */
function openAdvanceQuarterModal() {
    const flaggedCount = currentGame.events.filter(e => e.flaggedForDeletion).length;
    document.getElementById('advanceQuarterText').innerText = `Advance to Quarter ${currentGame.currentQuarter + 1}? ${flaggedCount > 0 ? flaggedCount + ' play(s) flagged for deletion will be purged & reverted.' : 'No flagged plays pending deletion.'}`;
    document.getElementById('advanceQuarterModal').classList.remove('hidden');
}

function closeAdvanceQuarterModal() {
    document.getElementById('advanceQuarterModal').classList.add('hidden');
}

function confirmAdvanceQuarter() {
    const flaggedEvents = currentGame.events.filter(e => e.flaggedForDeletion);
    flaggedEvents.forEach(evt => {
        revertSingleEventStats(evt);
    });

    currentGame.events = currentGame.events.filter(e => !e.flaggedForDeletion);

    currentGame.currentQuarter++;
    closeAdvanceQuarterModal();
    renderAllViews();
    saveCurrentGameToStorage();
    logEvent(`Advanced to Quarter ${currentGame.currentQuarter}`, null, null);
}

function revertSingleEventStats(lastEvt) {
    if (lastEvt.teamKey && lastEvt.playerId && lastEvt.statType) {
        const team = lastEvt.teamKey === 'home' ? currentGame.homeTeam : currentGame.awayTeam;
        const player = team.roster.find(p => p.id === lastEvt.playerId);

        if (player) {
            const s = player.stats;
            const qIdx = Math.max(0, (lastEvt.quarter || 1) - 1);
            switch (lastEvt.statType) {
                case '2PT_MADE':
                    s.pts -= 2; s.fgm -= 1; s.fga -= 1;
                    team.scoreByQuarter[qIdx] = Math.max(0, (team.scoreByQuarter[qIdx] || 0) - 2);
                    break;
                case '2PT_SUB':
                    s.pts += 2; s.fgm += 1; s.fga += 1;
                    team.scoreByQuarter[qIdx] = (team.scoreByQuarter[qIdx] || 0) + 2;
                    break;
                case '3PT_MADE':
                    s.pts -= 3; s.fgm -= 1; s.fga -= 1; s.pm3 -= 1; s.pa3 -= 1;
                    team.scoreByQuarter[qIdx] = Math.max(0, (team.scoreByQuarter[qIdx] || 0) - 3);
                    break;
                case '3PT_SUB':
                    s.pts += 3; s.fgm += 1; s.fga += 1; s.pm3 += 1; s.pa3 += 1;
                    team.scoreByQuarter[qIdx] = (team.scoreByQuarter[qIdx] || 0) + 3;
                    break;
                case 'FT_MADE':
                    s.pts -= 1; s.ftm -= 1; s.fta -= 1;
                    team.scoreByQuarter[qIdx] = Math.max(0, (team.scoreByQuarter[qIdx] || 0) - 1);
                    break;
                case 'FT_SUB':
                    s.pts += 1; s.ftm += 1; s.fta += 1;
                    team.scoreByQuarter[qIdx] = (team.scoreByQuarter[qIdx] || 0) + 1;
                    break;
                case 'OFF_REB': s.offReb = Math.max(0, s.offReb - 1); break;
                case 'DEF_REB': s.defReb = Math.max(0, s.defReb - 1); break;
                case 'AST': s.ast = Math.max(0, s.ast - 1); break;
                case 'STL': s.stl = Math.max(0, s.stl - 1); break;
                case 'BLK': s.blk = Math.max(0, s.blk - 1); break;
                case 'TO': s.to = Math.max(0, s.to - 1); break;
                case 'FOUL': 
                    s.pf = Math.max(0, s.pf - 1);
                    if (team.quarterFouls && team.quarterFouls[qIdx] !== undefined) {
                        team.quarterFouls[qIdx] = Math.max(0, team.quarterFouls[qIdx] - 1);
                    }
                    break;
            }
        }
    }
}

/**
 * DIRECT-ACTION STAT RECORDING ENGINE
 */
function recordDirectStat(teamKey, playerId, statType) {
    const team = teamKey === 'home' ? currentGame.homeTeam : currentGame.awayTeam;
    const player = team.roster.find(p => p.id === playerId);
    if (!player) return;

    const s = player.stats;
    const qIdx = currentGame.currentQuarter - 1;
    let description = "";

    switch (statType) {
        case '2PT_MADE':
            s.pts += 2; s.fgm += 1; s.fga += 1;
            team.scoreByQuarter[qIdx] = (team.scoreByQuarter[qIdx] || 0) + 2;
            description = `2PT Made by #${player.number} ${player.name}`;
            break;
        case '2PT_SUB':
            if (s.pts >= 2 && s.fgm > 0 && s.fga > 0) {
                s.pts -= 2; s.fgm -= 1; s.fga -= 1;
                team.scoreByQuarter[qIdx] = Math.max(0, (team.scoreByQuarter[qIdx] || 0) - 2);
                description = `-2PT Correction for #${player.number} ${player.name}`;
            }
            break;
        case '3PT_MADE':
            s.pts += 3; s.fgm += 1; s.fga += 1; s.pm3 += 1; s.pa3 += 1;
            team.scoreByQuarter[qIdx] = (team.scoreByQuarter[qIdx] || 0) + 3;
            description = `3PT Made by #${player.number} ${player.name}`;
            break;
        case '3PT_SUB':
            if (s.pts >= 3 && s.fgm > 0 && s.fga > 0 && s.pm3 > 0 && s.pa3 > 0) {
                s.pts -= 3; s.fgm -= 1; s.fga -= 1; s.pm3 -= 1; s.pa3 -= 1;
                team.scoreByQuarter[qIdx] = Math.max(0, (team.scoreByQuarter[qIdx] || 0) - 3);
                description = `-3PT Correction for #${player.number} ${player.name}`;
            }
            break;
        case 'FT_MADE':
            s.pts += 1; s.ftm += 1; s.fta += 1;
            team.scoreByQuarter[qIdx] = (team.scoreByQuarter[qIdx] || 0) + 1;
            description = `Free Throw Made by #${player.number} ${player.name}`;
            break;
        case 'FT_SUB':
            if (s.pts >= 1 && s.ftm > 0 && s.fta > 0) {
                s.pts -= 1; s.ftm -= 1; s.fta -= 1;
                team.scoreByQuarter[qIdx] = Math.max(0, (team.scoreByQuarter[qIdx] || 0) - 1);
                description = `-1 FT Correction for #${player.number} ${player.name}`;
            }
            break;
        case 'OFF_REB':
            s.offReb += 1;
            description = `Offensive Rebound by #${player.number} ${player.name}`;
            break;
        case 'DEF_REB':
            s.defReb += 1;
            description = `Defensive Rebound by #${player.number} ${player.name}`;
            break;
        case 'AST':
            s.ast += 1;
            description = `Assist by #${player.number} ${player.name}`;
            break;
        case 'STL':
            s.stl += 1;
            description = `Steal by #${player.number} ${player.name}`;
            break;
        case 'BLK':
            s.blk += 1;
            description = `Block by #${player.number} ${player.name}`;
            break;
        case 'TO':
            s.to += 1;
            description = `Turnover by #${player.number} ${player.name}`;
            break;
        case 'FOUL':
            s.pf += 1;
            if (!team.quarterFouls) team.quarterFouls = [0,0,0,0];
            team.quarterFouls[qIdx] = (team.quarterFouls[qIdx] || 0) + 1;
            description = `Personal Foul on #${player.number} ${player.name}`;
            break;
    }

    if (description) {
        logEvent(description, teamKey, playerId, statType);
        renderScoreboard();
        renderCourtPlayers();
        saveCurrentGameToStorage();
    }
}

function logEvent(description, teamKey, playerId, statType = null) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const event = {
        id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        timestamp: timeStr,
        quarter: currentGame.currentQuarter,
        teamKey,
        playerId,
        statType,
        description,
        flaggedForDeletion: false
    };
    currentGame.events.unshift(event);
    renderPlayLog();
}

function toggleFlagEvent(eventId) {
    const evt = currentGame.events.find(e => e.id === eventId);
    if (evt) {
        evt.flaggedForDeletion = !evt.flaggedForDeletion;
        renderPlayLog();
        saveCurrentGameToStorage();
    }
}

function undoLastEvent() {
    if (currentGame.events.length === 0) {
        showMessageModal("Nothing to Undo", "No play events found in log.");
        return;
    }

    const lastEvt = currentGame.events.shift();
    revertSingleEventStats(lastEvt);

    renderScoreboard();
    renderCourtPlayers();
    renderPlayLog();
    saveCurrentGameToStorage();
}

/**
 * SUBSTITUTIONS ENGINE
 */
function executeSubstitution(teamKey, subPlayerId, activePlayerId) {
    const team = teamKey === 'home' ? currentGame.homeTeam : currentGame.awayTeam;
    const subPlayer = team.roster.find(p => p.id === subPlayerId);
    const activePlayer = team.roster.find(p => p.id === activePlayerId);

    if (subPlayer && activePlayer) {
        subPlayer.onCourt = true;
        activePlayer.onCourt = false;
        logEvent(`Sub: #${subPlayer.number} ${subPlayer.name} in for #${activePlayer.number} ${activePlayer.name}`, teamKey, null);
        renderCourtPlayers();
        saveCurrentGameToStorage();
    }
}

function promptTapSubstitute(teamKey, subPlayerId) {
    const team = teamKey === 'home' ? currentGame.homeTeam : currentGame.awayTeam;
    const subPlayer = team.roster.find(p => p.id === subPlayerId);
    const activePlayers = team.roster.filter(p => p.onCourt);

    if (!subPlayer || activePlayers.length === 0) return;

    let promptMsg = `Substitute #${subPlayer.number} ${subPlayer.name} for which active player?\n\n`;
    activePlayers.forEach((p, idx) => {
        promptMsg += `${idx + 1}. #${p.number} ${p.name}\n`;
    });

    const choice = prompt(promptMsg, "1");
    if (choice !== null) {
        const index = parseInt(choice, 10) - 1;
        if (!isNaN(index) && index >= 0 && index < activePlayers.length) {
            executeSubstitution(teamKey, subPlayerId, activePlayers[index].id);
        }
    }
}

/**
 * RENDERING ENGINE
 */
function renderAllViews() {
    renderScoreboard();
    renderCourtPlayers();
    renderPlayLog();
    renderRosterSetupTab();
}

function renderScoreboard() {
    const banner = document.getElementById('scoreboardBanner');
    banner.classList.remove('hidden');

    const isSingle = currentGame.trackingMode === 'SINGLE';
    const oppKey = currentGame.myTeam === 'home' ? 'away' : 'home';
    const qIdx = Math.max(0, currentGame.currentQuarter - 1);

    document.getElementById('homeScoreName').innerText = currentGame.homeTeam.name + (isSingle && currentGame.myTeam === 'home' ? ' (MY TEAM)' : '');
    document.getElementById('homeColorBadge').style.backgroundColor = currentGame.homeTeam.color;
    document.getElementById('homeQuarterFouls').innerText = (currentGame.homeTeam.quarterFouls && currentGame.homeTeam.quarterFouls[qIdx]) || 0;
    document.getElementById('homeTimeoutsCount').innerText = currentGame.homeTeam.timeoutsTaken || 0;

    const awayCard = document.getElementById('scoreboardAwayCard');
    if (isSingle && oppKey === 'away') {
        awayCard.classList.add('hidden');
    } else {
        awayCard.classList.remove('hidden');
        document.getElementById('awayScoreName').innerText = currentGame.awayTeam.name + (isSingle && currentGame.myTeam === 'away' ? ' (MY TEAM)' : '');
        document.getElementById('awayColorBadge').style.backgroundColor = currentGame.awayTeam.color;
        document.getElementById('awayQuarterFouls').innerText = (currentGame.awayTeam.quarterFouls && currentGame.awayTeam.quarterFouls[qIdx]) || 0;
        document.getElementById('awayTimeoutsCount').innerText = currentGame.awayTeam.timeoutsTaken || 0;
    }

    document.getElementById('periodDisplay').innerText = currentGame.currentQuarter > 4 ? `OT${currentGame.currentQuarter - 4}` : `QUARTER ${currentGame.currentQuarter}`;
}

function renderCourtPlayers() {
    const isSingle = currentGame.trackingMode === 'SINGLE';
    const oppKey = currentGame.myTeam === 'home' ? 'away' : 'home';
    const layoutContainer = document.getElementById('courtTeamsLayout');

    if (isSingle) {
        layoutContainer.className = "grid grid-cols-1 gap-4";
    } else {
        layoutContainer.className = "grid grid-cols-1 lg:grid-cols-2 gap-4";
    }

    if (isSingle && oppKey === 'home') {
        document.getElementById('homeActiveSection').classList.add('hidden');
    } else {
        document.getElementById('homeActiveSection').classList.remove('hidden');
        document.getElementById('homeTeamTileBadge').style.backgroundColor = currentGame.homeTeam.color;
        document.getElementById('homeTeamSectionTitle').innerText = `${currentGame.homeTeam.name} - Active Players`;
        renderTeamActiveTiles('home', currentGame.homeTeam, 'homeActiveTilesContainer', isSingle);
        renderTeamBenchTiles('home', currentGame.homeTeam, 'homeBenchContainer');
    }

    if (isSingle && oppKey === 'away') {
        document.getElementById('awayActiveSection').classList.add('hidden');
    } else {
        document.getElementById('awayActiveSection').classList.remove('hidden');
        document.getElementById('awayTeamTileBadge').style.backgroundColor = currentGame.awayTeam.color;
        document.getElementById('awayTeamSectionTitle').innerText = `${currentGame.awayTeam.name} - Active Players`;
        renderTeamActiveTiles('away', currentGame.awayTeam, 'awayActiveTilesContainer', isSingle);
        renderTeamBenchTiles('away', currentGame.awayTeam, 'awayBenchContainer');
    }
}

function renderTeamActiveTiles(teamKey, team, containerId, isSingleMode) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (isSingleMode) {
        container.className = "grid grid-cols-1 md:grid-cols-2 gap-3";
    } else {
        container.className = "space-y-3";
    }

    const activeOnCourt = team.roster.filter(p => p.onCourt);

    if (activeOnCourt.length === 0) {
        container.innerHTML = `<div class="text-center text-xs text-slate-500 py-4 col-span-full">No active players on court. Tap bench players below to assign starters.</div>`;
        return;
    }

    activeOnCourt.forEach(player => {
        const s = player.stats;
        const fgPct = s.fga > 0 ? ((s.fgm / s.fga) * 100).toFixed(0) + '%' : '0%';
        
        let foulBoxesHtml = '<div class="flex items-center space-x-1 ml-2" title="Personal Fouls">';
        for (let i = 1; i <= 5; i++) {
            if (s.pf >= i) {
                foulBoxesHtml += `<span class="w-3.5 h-3.5 rounded bg-rose-600 border border-rose-400 shadow-sm animate-pulse inline-block"></span>`;
            } else {
                foulBoxesHtml += `<span class="w-3.5 h-3.5 rounded bg-rose-950/60 border border-rose-900/40 inline-block"></span>`;
            }
        }
        if (s.pf >= 5) {
            foulBoxesHtml += `<span class="text-[9px] font-black text-rose-400 uppercase tracking-tighter ml-1">FOUL OUT!</span>`;
        }
        foulBoxesHtml += '</div>';

        const tile = document.createElement('div');
        tile.className = "w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 shadow-md space-y-3 transition-all";
        
        tile.addEventListener('dragover', (e) => {
            e.preventDefault();
            tile.classList.add('drag-over-target');
        });
        tile.addEventListener('dragleave', () => {
            tile.classList.remove('drag-over-target');
        });
        tile.addEventListener('drop', (e) => {
            e.preventDefault();
            tile.classList.remove('drag-over-target');
            if (draggedPlayer && draggedPlayer.teamKey === teamKey) {
                executeSubstitution(teamKey, draggedPlayer.playerId, player.id);
                draggedPlayer = null;
            }
        });

        tile.innerHTML = `
            <div class="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div class="flex items-center space-x-3">
                    <span class="text-3xl sm:text-4xl font-black font-mono text-orange-400 tracking-tighter leading-none bg-orange-950/80 px-2.5 py-1 rounded-xl border border-orange-800/60 shadow">
                        #${player.number}
                    </span>
                    <div>
                        <div class="flex items-center">
                            <h4 class="font-extrabold text-sm sm:text-base text-white truncate max-w-[140px]">${player.name}</h4>
                            ${foulBoxesHtml}
                        </div>
                        <div class="text-[11px] font-mono text-slate-300 mt-1">
                            ${s.fgm}/${s.fga} FG (${fgPct}) | ${s.pm3}/${s.pa3} 3PT | ${s.ftm}/${s.fta} FT
                        </div>
                        <div class="text-[11px] font-mono font-bold text-amber-300/90 mt-0.5">
                            REB: ${s.offReb + s.defReb} (O:${s.offReb} D:${s.defReb}) | AST: ${s.ast} | PTS: ${s.pts}
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-7 gap-1.5 text-xs font-black">
                <button onclick="recordDirectStat('${teamKey}', '${player.id}', '2PT_MADE')" class="action-btn btn-sq bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow">+2</button>
                <button onclick="recordDirectStat('${teamKey}', '${player.id}', '3PT_MADE')" class="action-btn btn-sq bg-emerald-700 hover:bg-emerald-600 text-amber-200 rounded-xl shadow">+3</button>
                <button onclick="recordDirectStat('${teamKey}', '${player.id}', 'FT_MADE')" class="action-btn btn-sq bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl shadow">+1FT</button>
                <button onclick="recordDirectStat('${teamKey}', '${player.id}', 'OFF_REB')" class="action-btn btn-sq bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow text-[10px]">OFF REB</button>
                <button onclick="recordDirectStat('${teamKey}', '${player.id}', 'STL')" class="action-btn btn-sq bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow">STL</button>
                <button onclick="recordDirectStat('${teamKey}', '${player.id}', 'TO')" class="action-btn btn-sq bg-amber-700 hover:bg-amber-600 text-white rounded-xl shadow">TO</button>
                
                <button onclick="recordDirectStat('${teamKey}', '${player.id}', 'FOUL')" class="action-btn col-span-1 row-span-2 bg-rose-700 hover:bg-rose-600 active:bg-rose-800 text-white rounded-xl shadow flex flex-col items-center justify-center h-full min-h-[72px] border border-rose-500/50">
                    <i class="fa-solid fa-hand text-xs mb-0.5"></i>
                    <span>FOUL</span>
                </button>

                <button onclick="recordDirectStat('${teamKey}', '${player.id}', '2PT_SUB')" class="action-btn btn-sq bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 rounded-xl">-2</button>
                <button onclick="recordDirectStat('${teamKey}', '${player.id}', '3PT_SUB')" class="action-btn btn-sq bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 rounded-xl">-3</button>
                <button onclick="recordDirectStat('${teamKey}', '${player.id}', 'FT_SUB')" class="action-btn btn-sq bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 rounded-xl">-1FT</button>
                <button onclick="recordDirectStat('${teamKey}', '${player.id}', 'DEF_REB')" class="action-btn btn-sq bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow text-[10px]">DEF REB</button>
                <button onclick="recordDirectStat('${teamKey}', '${player.id}', 'AST')" class="action-btn btn-sq bg-sky-600 hover:bg-sky-500 text-white rounded-xl shadow">AST</button>
                <button onclick="recordDirectStat('${teamKey}', '${player.id}', 'BLK')" class="action-btn btn-sq bg-teal-600 hover:bg-teal-500 text-white rounded-xl shadow">BLK</button>
            </div>
        `;

        container.appendChild(tile);
    });
}

function renderTeamBenchTiles(teamKey, team, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    const benchPlayers = team.roster.filter(p => !p.onCourt);

    if (benchPlayers.length === 0) {
        container.innerHTML = `<span class="text-xs text-slate-500 italic">No substitutes on bench.</span>`;
        return;
    }

    benchPlayers.forEach(player => {
        const subTile = document.createElement('div');
        subTile.draggable = true;
        subTile.className = "draggable-tile bg-slate-950 border border-slate-800 hover:border-orange-500/50 rounded-xl px-3 py-2 cursor-grab active:cursor-grabbing flex items-center space-x-2 text-xs shadow transition";

        subTile.addEventListener('dragstart', (e) => {
            draggedPlayer = { teamKey, playerId: player.id };
            e.dataTransfer.setData('text/plain', player.id);
        });

        subTile.addEventListener('click', () => {
            promptTapSubstitute(teamKey, player.id);
        });

        subTile.innerHTML = `
            <i class="fa-solid fa-grip-vertical text-slate-600 text-[10px]"></i>
            <span class="font-mono font-bold text-orange-400">#${player.number}</span>
            <span class="font-semibold text-slate-200">${player.name}</span>
        `;

        container.appendChild(subTile);
    });
}

function renderPlayLog() {
    const container = document.getElementById('playLogContainer');
    container.innerHTML = '';

    if (currentGame.events.length === 0) {
        container.innerHTML = `<div class="text-slate-500 italic text-center py-3">No plays logged yet. Tapping player stat buttons logs real-time events here.</div>`;
        return;
    }

    currentGame.events.forEach(evt => {
        const isFlagged = evt.flaggedForDeletion;
        const item = document.createElement('div');
        item.className = `flex items-center justify-between p-2 rounded-xl border text-xs transition-all ${
            isFlagged 
            ? 'bg-rose-950/40 border-rose-800/80 text-rose-200 line-through' 
            : 'bg-slate-950 border-slate-800 text-slate-200'
        }`;

        item.innerHTML = `
            <div class="flex items-center space-x-2">
                <span class="text-[10px] font-mono text-orange-400 font-bold bg-orange-950/60 px-1.5 py-0.5 rounded border border-orange-800/40">Q${evt.quarter}</span>
                <span class="text-xs font-semibold">${evt.description}</span>
            </div>
            <div class="flex items-center space-x-2">
                <span class="text-[10px] text-slate-400 font-mono">${evt.timestamp}</span>
                <button onclick="toggleFlagEvent('${evt.id}')" class="action-btn p-1 px-2 rounded-lg border text-[11px] ${
                    isFlagged 
                    ? 'bg-rose-700 text-white border-rose-500 font-bold' 
                    : 'bg-slate-800 text-slate-400 hover:text-rose-400 border-slate-700'
                }" title="Flag for Purge on Next Quarter">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
        container.appendChild(item);
    });
}

/**
 * BOX SCORE TABLE RENDERING
 */
function renderBoxScoreTables() {
    const isSingle = currentGame.trackingMode === 'SINGLE';
    const oppKey = currentGame.myTeam === 'home' ? 'away' : 'home';

    if (isSingle && oppKey === 'home') {
        document.getElementById('homeBoxSection').classList.add('hidden');
    } else {
        document.getElementById('homeBoxSection').classList.remove('hidden');
        renderTeamBoxTable(currentGame.homeTeam, 'homeBoxBadge', 'homeBoxTitle', 'homeBoxScoreBody', 'homeBoxScoreFoot');
    }

    if (isSingle && oppKey === 'away') {
        document.getElementById('awayBoxSection').classList.add('hidden');
    } else {
        document.getElementById('awayBoxSection').classList.remove('hidden');
        renderTeamBoxTable(currentGame.awayTeam, 'awayBoxBadge', 'awayBoxTitle', 'awayBoxScoreBody', 'awayBoxScoreFoot');
    }
}

function renderTeamBoxTable(team, badgeId, titleId, bodyId, footId) {
    document.getElementById(badgeId).style.backgroundColor = team.color;
    document.getElementById(titleId).innerText = `${team.name} Box Score`;

    const tbody = document.getElementById(bodyId);
    const tfoot = document.getElementById(footId);
    tbody.innerHTML = '';

    let totals = createEmptyStats();

    team.roster.forEach(player => {
        const s = player.stats;
        totals.pts += s.pts;
        totals.fgm += s.fgm; totals.fga += s.fga;
        totals.pm3 += s.pm3; totals.pa3 += s.pa3;
        totals.ftm += s.ftm; totals.fta += s.fta;
        totals.offReb += s.offReb; totals.defReb += s.defReb;
        totals.ast += s.ast; totals.stl += s.stl; totals.blk += s.blk;
        totals.to += s.to; totals.pf += s.pf;

        const fgPct = s.fga > 0 ? ((s.fgm / s.fga) * 100).toFixed(0) + '%' : '0%';
        const p3Pct = s.pa3 > 0 ? ((s.pm3 / s.pa3) * 100).toFixed(0) + '%' : '0%';
        const ftPct = s.fta > 0 ? ((s.ftm / s.fta) * 100).toFixed(0) + '%' : '0%';

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-800/40 text-slate-200 border-b border-slate-800/60";
        tr.innerHTML = `
            <td class="p-2 font-bold text-orange-400">#${player.number}</td>
            <td class="p-2 font-semibold text-white truncate max-w-[130px]">${player.name} ${player.onCourt ? '<span class="text-[9px] text-emerald-400 ml-1">(On)</span>' : ''}</td>
            <td class="p-2 text-center font-bold text-amber-300 text-sm">${s.pts}</td>
            <td class="p-2 text-center">${s.fgm}/${s.fga}</td>
            <td class="p-2 text-center text-slate-400">${fgPct}</td>
            <td class="p-2 text-center">${s.pm3}/${s.pa3}</td>
            <td class="p-2 text-center text-slate-400">${p3Pct}</td>
            <td class="p-2 text-center">${s.ftm}/${s.fta}</td>
            <td class="p-2 text-center text-slate-400">${ftPct}</td>
            <td class="p-2 text-center font-semibold">${s.offReb + s.defReb} (${s.offReb}/${s.defReb})</td>
            <td class="p-2 text-center">${s.ast}</td>
            <td class="p-2 text-center">${s.stl}</td>
            <td class="p-2 text-center">${s.blk}</td>
            <td class="p-2 text-center text-amber-400/90">${s.to}</td>
            <td class="p-2 text-center text-rose-400/90">${s.pf}</td>
        `;
        tbody.appendChild(tr);
    });

    const totFgPct = totals.fga > 0 ? ((totals.fgm / totals.fga) * 100).toFixed(0) + '%' : '0%';
    const tot3Pct = totals.pa3 > 0 ? ((totals.pm3 / totals.pa3) * 100).toFixed(0) + '%' : '0%';
    const totFtPct = totals.fta > 0 ? ((totals.ftm / totals.fta) * 100).toFixed(0) + '%' : '0%';

    tfoot.innerHTML = `
        <tr class="text-white">
            <td class="p-2" colspan="2">TOTALS</td>
            <td class="p-2 text-center text-amber-400 text-sm">${totals.pts}</td>
            <td class="p-2 text-center">${totals.fgm}/${totals.fga}</td>
            <td class="p-2 text-center text-slate-400">${totFgPct}</td>
            <td class="p-2 text-center">${totals.pm3}/${totals.pa3}</td>
            <td class="p-2 text-center text-slate-400">${tot3Pct}</td>
            <td class="p-2 text-center">${totals.ftm}/${totals.fta}</td>
            <td class="p-2 text-center text-slate-400">${totFtPct}</td>
            <td class="p-2 text-center">${totals.offReb + totals.defReb} (${totals.offReb}/${totals.defReb})</td>
            <td class="p-2 text-center">${totals.ast}</td>
            <td class="p-2 text-center">${totals.stl}</td>
            <td class="p-2 text-center">${totals.blk}</td>
            <td class="p-2 text-center">${totals.to}</td>
            <td class="p-2 text-center">${totals.pf}</td>
        </tr>
    `;
}

/**
 * SETUP CONTROLLER
 */
function renderRosterSetupTab() {
    const toggle = document.getElementById('trackingModeToggle');
    const isSingle = currentGame.trackingMode === 'SINGLE';
    toggle.checked = isSingle;

    const myTeamWrapper = document.getElementById('myTeamSelectWrapper');
    const myTeamSelect = document.getElementById('myTeamSelect');
    const desc = document.getElementById('modeDescription');

    if (isSingle) {
        myTeamWrapper.classList.remove('opacity-50', 'pointer-events-none');
        desc.innerText = "Track My Team Only (Opponent completely hidden)";
    } else {
        myTeamWrapper.classList.add('opacity-50', 'pointer-events-none');
        desc.innerText = "Track Both Teams (Side-by-side active tiles)";
    }
    myTeamSelect.value = currentGame.myTeam || 'home';

    document.getElementById('homeTeamNameInput').value = currentGame.homeTeam.name;
    document.getElementById('homeTeamColorInput').value = currentGame.homeTeam.color;
    document.getElementById('awayTeamNameInput').value = currentGame.awayTeam.name;
    document.getElementById('awayTeamColorInput').value = currentGame.awayTeam.color;

    const oppKey = currentGame.myTeam === 'home' ? 'away' : 'home';
    if (isSingle && oppKey === 'home') {
        document.getElementById('homeRosterInputBlock').classList.add('hidden');
        document.getElementById('homeRosterTitle').innerText = 'Home Team Setup (Opponent - Hidden)';
    } else {
        document.getElementById('homeRosterInputBlock').classList.remove('hidden');
        document.getElementById('homeRosterTitle').innerText = 'Home Team Setup';
    }

    if (isSingle && oppKey === 'away') {
        document.getElementById('awayRosterInputBlock').classList.add('hidden');
        document.getElementById('awayRosterTitle').innerText = 'Away Team Setup (Opponent - Hidden)';
    } else {
        document.getElementById('awayRosterInputBlock').classList.remove('hidden');
        document.getElementById('awayRosterTitle').innerText = 'Away Team Setup';
    }

    renderRosterList('home', currentGame.homeTeam.roster, 'homeRosterList');
    renderRosterList('away', currentGame.awayTeam.roster, 'awayRosterList');
}

function renderRosterList(teamKey, roster, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    roster.forEach(player => {
        const item = document.createElement('div');
        item.className = "flex items-center justify-between p-2 bg-slate-950 rounded-xl border border-slate-800 text-xs";
        item.innerHTML = `
            <div class="flex items-center space-x-2">
                <span class="font-mono font-bold text-orange-400 w-6">#${player.number}</span>
                <span class="font-semibold text-white">${player.name}</span>
            </div>
            <div class="flex items-center space-x-2">
                <button onclick="toggleStarterStatus('${teamKey}', '${player.id}')" class="text-[10px] ${player.onCourt ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-slate-800 text-slate-400 border-slate-700'} border px-2 py-0.5 rounded-lg font-medium">
                    ${player.onCourt ? 'Active 5' : 'Bench'}
                </button>
                <button onclick="removePlayerFromRoster('${teamKey}', '${player.id}')" class="text-rose-400 hover:text-rose-300 p-1">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                </button>
            </div>
        `;
        container.appendChild(item);
    });
}

function toggleStarterStatus(teamKey, playerId) {
    const team = teamKey === 'home' ? currentGame.homeTeam : currentGame.awayTeam;
    const player = team.roster.find(p => p.id === playerId);
    if (player) {
        const activeCount = team.roster.filter(p => p.onCourt).length;
        if (!player.onCourt && activeCount >= 5) {
            showMessageModal("Max 5 Active Players", "You already have 5 active starters on court. Move an active player to the bench first.");
            return;
        }
        player.onCourt = !player.onCourt;
        renderRosterSetupTab();
        renderCourtPlayers();
        saveCurrentGameToStorage();
    }
}

function addPlayerToRoster(teamKey) {
    const numberInput = document.getElementById(teamKey === 'home' ? 'newHomeJersey' : 'newAwayJersey');
    const nameInput = document.getElementById(teamKey === 'home' ? 'newHomeName' : 'newAwayName');

    const number = numberInput.value.trim();
    const name = nameInput.value.trim();

    if (!number || !name) {
        showMessageModal("Missing Fields", "Please enter both jersey number and player name.");
        return;
    }

    const team = teamKey === 'home' ? currentGame.homeTeam : currentGame.awayTeam;
    const newPlayer = {
        id: (teamKey === 'home' ? 'h' : 'a') + Date.now(),
        number,
        name,
        onCourt: team.roster.filter(p => p.onCourt).length < 5,
        stats: createEmptyStats()
    };

    team.roster.push(newPlayer);
    numberInput.value = '';
    nameInput.value = '';

    renderRosterSetupTab();
    renderCourtPlayers();
    saveCurrentGameToStorage();
}

function removePlayerFromRoster(teamKey, playerId) {
    const team = teamKey === 'home' ? currentGame.homeTeam : currentGame.awayTeam;
    team.roster = team.roster.filter(p => p.id !== playerId);
    renderRosterSetupTab();
    renderCourtPlayers();
    saveCurrentGameToStorage();
}

function saveRosterChanges() {
    currentGame.homeTeam.name = document.getElementById('homeTeamNameInput').value.trim() || 'Home Warriors';
    currentGame.homeTeam.color = document.getElementById('homeTeamColorInput').value;
    currentGame.awayTeam.name = document.getElementById('awayTeamNameInput').value.trim() || 'Away Titans';
    currentGame.awayTeam.color = document.getElementById('awayTeamColorInput').value;

    saveCurrentGameToStorage();
    renderAllViews();
    showMessageModal("Setup Saved", "Team setup and roster configurations updated.");
}

function createNewGamePrompt() {
    if (confirm("Start a new game? Current match state will be archived in IndexedDB.")) {
        currentGame.status = 'COMPLETED';
        saveCurrentGameToStorage();

        currentGame = {
            id: 'game_' + Date.now(),
            date: new Date().toISOString(),
            status: 'IN_PROGRESS',
            trackingMode: currentGame.trackingMode || 'SINGLE',
            myTeam: currentGame.myTeam || 'home',
            showScoreboard: currentGame.showScoreboard,
            currentQuarter: 1,
            homeTeam: { name: currentGame.homeTeam.name, color: currentGame.homeTeam.color, scoreByQuarter: [0,0,0,0], quarterFouls: [0,0,0,0], timeoutsTaken: 0, roster: [] },
            awayTeam: { name: currentGame.awayTeam.name, color: currentGame.awayTeam.color, scoreByQuarter: [0,0,0,0], quarterFouls: [0,0,0,0], timeoutsTaken: 0, roster: [] },
            events: []
        };

        initDefaultRosters();
        renderAllViews();
        saveCurrentGameToStorage();
        switchTab('tracker');
        showMessageModal("New Game Started", "Ready to log box score events!");
    }
}

/**
 * SAVED MATCHES & EXPORTS
 */
async function loadSavedMatchesList() {
    const container = document.getElementById('savedMatchesContainer');
    container.innerHTML = '<div class="text-slate-500 text-xs italic py-2">Loading saved matches from IndexedDB...</div>';

    if (!db) await initDatabase();

    const tx = db.transaction('matches', 'readonly');
    const store = tx.objectStore('matches');
    const request = store.getAll();

    request.onsuccess = () => {
        const matches = request.result || [];
        container.innerHTML = '';

        if (matches.length === 0) {
            container.innerHTML = '<div class="text-slate-500 text-xs italic py-2">No saved matches in database.</div>';
            return;
        }

        matches.sort((a,b) => new Date(b.date) - new Date(a.date));

        matches.forEach(m => {
            const item = document.createElement('div');
            item.className = "flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs";
            
            const hTot = m.homeTeam.scoreByQuarter ? m.homeTeam.scoreByQuarter.reduce((a,b)=>a+b, 0) : 0;
            const aTot = m.awayTeam.scoreByQuarter ? m.awayTeam.scoreByQuarter.reduce((a,b)=>a+b, 0) : 0;
            const isSingle = m.trackingMode === 'SINGLE';

            item.innerHTML = `
                <div>
                    <div class="font-bold text-white text-sm">
                        ${m.homeTeam.name} (${hTot} pts) ${isSingle ? '' : 'vs ' + m.awayTeam.name + ' (' + aTot + ' pts)'}
                    </div>
                    <div class="text-[10px] text-slate-400 mt-0.5">${new Date(m.date).toLocaleString()} | ${m.events.length} plays logged</div>
                </div>
                <div class="flex items-center space-x-2">
                    <button onclick="loadSavedGame('${m.id}')" class="action-btn bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded-lg font-bold">Load</button>
                    <button onclick="deleteSavedGame('${m.id}')" class="action-btn bg-slate-800 text-rose-400 p-1.5 rounded-lg border border-slate-700"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            container.appendChild(item);
        });
    };
}

function loadSavedGame(matchId) {
    const tx = db.transaction('matches', 'readonly');
    const store = tx.objectStore('matches');
    const request = store.get(matchId);

    request.onsuccess = () => {
        if (request.result) {
            currentGame = request.result;
            renderAllViews();
            switchTab('tracker');
            showMessageModal("Match Loaded", "Loaded selected match into active live tracker.");
        }
    };
}

function deleteSavedGame(matchId) {
    if (confirm("Delete this match record from IndexedDB?")) {
        const tx = db.transaction('matches', 'readwrite');
        const store = tx.objectStore('matches');
        store.delete(matchId);
        tx.oncomplete = () => loadSavedMatchesList();
    }
}

function exportGameCSV() {
    let csv = "Team,Jersey,Name,PTS,FGM,FGA,FG%,3PM,3PA,3P%,FTM,FTA,FT%,OFF_REB,DEF_REB,AST,STL,BLK,TO,PF\n";

    const appendTeam = (team) => {
        team.roster.forEach(p => {
            const s = p.stats;
            const fgPct = s.fga > 0 ? ((s.fgm/s.fga)*100).toFixed(1) : 0;
            const p3Pct = s.pa3 > 0 ? ((s.pm3/s.pa3)*100).toFixed(1) : 0;
            const ftPct = s.fta > 0 ? ((s.ftm/s.fta)*100).toFixed(1) : 0;
            csv += `"${team.name}",${p.number},"${p.name}",${s.pts},${s.fgm},${s.fga},${fgPct}%,${s.pm3},${s.pa3},${p3Pct}%,${s.ftm},${s.fta},${ftPct}%,${s.offReb},${s.defReb},${s.ast},${s.stl},${s.blk},${s.to},${s.pf}\n`;
        });
    };

    appendTeam(currentGame.homeTeam);
    if (currentGame.trackingMode !== 'SINGLE') {
        appendTeam(currentGame.awayTeam);
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BoxScore_${currentGame.homeTeam.name}_${Date.now()}.csv`;
    a.click();
}

function exportGameJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentGame, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `BoxScore_${currentGame.id}.json`;
    a.click();
}

function copyBoxScoreReport() {
    let text = `=== BASKETBALL BOX SCORE REPORT ===\n`;
    text += `Date: ${new Date(currentGame.date).toLocaleDateString()}\n`;
    text += `Match: ${currentGame.homeTeam.name} vs ${currentGame.awayTeam.name}\n\n`;

    const formatTeam = (team) => {
        let res = `--- ${team.name} ---\n`;
        team.roster.forEach(p => {
            const s = p.stats;
            res += `#${p.number} ${p.name}: ${s.pts} PTS | ${s.fgm}/${s.fga} FG | ${s.offReb+s.defReb} REB | ${s.ast} AST | ${s.stl} STL | ${s.blk} BLK | ${s.to} TO | ${s.pf} PF\n`;
        });
        return res + '\n';
    };

    text += formatTeam(currentGame.homeTeam);
    if (currentGame.trackingMode !== 'SINGLE') {
        text += formatTeam(currentGame.awayTeam);
    }

    document.execCommand('copy');
    showMessageModal("Report Copied", "Box score summary copied to clipboard!");
}

function showMessageModal(title, text) {
    document.getElementById('msgModalTitle').innerText = title;
    document.getElementById('msgModalText').innerText = text;
    document.getElementById('msgModal').classList.remove('hidden');
}

function closeMsgModal() {
    document.getElementById('msgModal').classList.add('hidden');
}

window.onload = async function() {
    startDeviceClock();
    updateOnlineStatus();
    await initDatabase();
    await loadGameFromStorage();
};
