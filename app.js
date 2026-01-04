const COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];
const CAPACITY = 7;
const BOOKS_PER_COLOR = 6;
const SHELF_COUNT = 6; // 5 colors + 2 empty shelves for sorting

class Game {
    constructor() {
        this.shelves = [];
        this.selectedShelfIndex = null;
        this.moves = 0;
        this.startTime = null;
        this.timerInterval = null;
        this.countdownInterval = null;
        this.isWon = false;
        this.isDailyCompleted = false;

        this.stats = this.loadStats();
        this.init();
    }

    async init() {
        this.setupDOM();
        await this.loadDailyPuzzle();

        const today = new Date().toISOString().split('T')[0];
        if (this.stats.history[today]) {
            this.handleDailyAlreadyCompleted();
        } else {
            this.startTimer();
        }

        this.startCountdown();
        this.render();
    }

    async loadDailyPuzzle() {
        try {
            const response = await fetch('puzzles.json');
            const puzzles = await response.json();
            const today = new Date().toISOString().split('T')[0];

            if (puzzles[today]) {
                this.shelves = puzzles[today].map(shelf => [...shelf]);
                console.log("Loaded puzzle for today:", today);
            } else {
                console.warn("No puzzle found for today, generating random.");
                this.generatePuzzle();
            }
        } catch (error) {
            console.error("Failed to load puzzles.json, generating random.", error);
            this.generatePuzzle();
        }
    }

    setupDOM() {
        this.shelfArea = document.getElementById('bookshelf-area');
        this.timerDisplay = document.getElementById('timer');
        this.moveDisplay = document.getElementById('move-count');
        this.winModal = document.getElementById('win-modal');
        this.tutorialModal = document.getElementById('tutorial-modal');
        this.statsModal = document.getElementById('stats-modal');

        document.getElementById('reset-btn').onclick = () => this.reset();
        document.getElementById('how-to-play-btn').onclick = () => this.toggleTutorial(true);
        document.getElementById('close-tutorial-btn').onclick = () => this.toggleTutorial(false);
        document.getElementById('play-again-btn').onclick = () => this.reset();

        document.getElementById('stats-btn').onclick = () => this.toggleStats(true);
        document.getElementById('close-stats-btn').onclick = () => this.toggleStats(false);
    }

    generatePuzzle() {
        // Each color has BOOKS_PER_COLOR books (fixed set)
        let allBooks = [];
        COLORS.forEach(color => {
            for (let i = 0; i < BOOKS_PER_COLOR; i++) {
                allBooks.push(color);
            }
        });

        // Shuffle books
        for (let i = allBooks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allBooks[i], allBooks[j]] = [allBooks[j], allBooks[i]];
        }

        // Initialize shelves
        this.shelves = Array.from({ length: SHELF_COUNT }, () => []);

        // Distribute books to first 5 shelves
        for (let i = 0; i < 5; i++) {
            this.shelves[i] = allBooks.slice(i * BOOKS_PER_COLOR, (i + 1) * BOOKS_PER_COLOR);
        }

        // Ensure no initial win or invalid state if necessary
        // In this game, any random distribution is solvable if you have enough empty shelves.
    }

    render() {
        this.shelfArea.innerHTML = '';
        this.shelves.forEach((books, index) => {
            const isFull = books.length === CAPACITY;
            const shelfContainer = document.createElement('div');
            shelfContainer.className = `shelf-container ${this.selectedShelfIndex === index ? 'selected' : ''} ${isFull ? 'full' : ''}`;
            shelfContainer.onclick = () => this.handleShelfClick(index);

            const booksStack = document.createElement('div');
            booksStack.className = 'books-stack';

            // Identify the volume that would move if this shelf is selected
            let raisedIdxThreshold = -1;
            if (this.selectedShelfIndex === index) {
                const volume = this.getVolume(index);
                if (volume) {
                    raisedIdxThreshold = books.length - volume.count;
                }
            }

            books.forEach((color, bookIdx) => {
                const book = document.createElement('div');
                book.className = 'book';
                if (bookIdx >= raisedIdxThreshold && raisedIdxThreshold !== -1) {
                    book.classList.add('raised');
                }
                book.style.backgroundImage = `url('assets/images/${color}_book.webp')`;
                booksStack.appendChild(book);
            });

            const shelfImage = document.createElement('div');
            shelfImage.className = 'shelf-image';

            shelfContainer.appendChild(booksStack);
            shelfContainer.appendChild(shelfImage);
            this.shelfArea.appendChild(shelfContainer);
        });

        this.moveDisplay.textContent = this.moves;
    }

    handleShelfClick(index) {
        if (this.isWon) return;

        if (this.selectedShelfIndex === null) {
            // Picking up
            if (this.shelves[index].length > 0) {
                this.selectedShelfIndex = index;
            }
        } else {
            // Moving or Deselecting
            if (this.selectedShelfIndex === index) {
                this.selectedShelfIndex = null;
            } else {
                this.tryMove(this.selectedShelfIndex, index);
                this.selectedShelfIndex = null;
            }
        }
        this.render();
    }

    getVolume(shelfIndex) {
        const shelf = this.shelves[shelfIndex];
        if (shelf.length === 0) return null;

        const color = shelf[shelf.length - 1];
        let count = 0;
        for (let i = shelf.length - 1; i >= 0; i--) {
            if (shelf[i] === color) {
                count++;
            } else {
                break;
            }
        }
        return { color, count };
    }

    tryMove(fromIndex, toIndex) {
        const fromShelf = this.shelves[fromIndex];
        const toShelf = this.shelves[toIndex];

        const volume = this.getVolume(fromIndex);
        if (!volume) return;

        // Check if destination is compatible
        const toShelfTopColor = toShelf.length > 0 ? toShelf[toShelf.length - 1] : null;

        if (toShelfTopColor !== null && toShelfTopColor !== volume.color) {
            // Cannot place on top of different color
            return;
        }

        if (toShelf.length + volume.count > CAPACITY) {
            // Cannot exceed capacity
            return;
        }

        // Perform move
        for (let i = 0; i < volume.count; i++) {
            toShelf.push(fromShelf.pop());
        }

        this.moves++;
        this.checkWin();
    }

    checkWin() {
        const isComplete = this.shelves.filter(s => s.length > 0).length === COLORS.length &&
            this.shelves.every(shelf => {
                if (shelf.length === 0) return true;
                if (shelf.length !== BOOKS_PER_COLOR) return false;
                const firstColor = shelf[0];
                return shelf.every(color => color === firstColor);
            });

        if (isComplete) {
            this.handleWin();
        }
    }

    handleWin() {
        this.isWon = true;
        clearInterval(this.timerInterval);

        const timeStr = this.timerDisplay.textContent;
        document.getElementById('final-time').textContent = timeStr;
        document.getElementById('final-moves').textContent = this.moves;

        this.saveResult(this.moves, timeStr);
        document.querySelector('#win-modal h2').textContent = "Puzzle Solved!";
        this.winModal.classList.remove('hidden');
    }

    loadStats() {
        const defaultStats = {
            history: {},
            currentStreak: 0,
            maxStreak: 0,
            lastCompletedDate: null
        };
        const saved = localStorage.getItem('redBook_stats');
        return saved ? JSON.parse(saved) : defaultStats;
    }

    saveResult(moves, time) {
        const today = new Date().toISOString().split('T')[0];
        if (this.stats.history[today]) return; // Already saved today

        this.stats.history[today] = { moves, time };
        this.isDailyCompleted = true;

        // Calculate streak
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (this.stats.lastCompletedDate === yesterdayStr) {
            this.stats.currentStreak++;
        } else if (this.stats.lastCompletedDate !== today) {
            this.stats.currentStreak = 1;
        }

        if (this.stats.currentStreak > this.stats.maxStreak) {
            this.stats.maxStreak = this.stats.currentStreak;
        }

        this.stats.lastCompletedDate = today;
        localStorage.setItem('redBook_stats', JSON.stringify(this.stats));
        this.updateStatsUI();
    }

    handleDailyAlreadyCompleted() {
        this.isDailyCompleted = true;
        this.isWon = true; // Disable further moves
        const today = new Date().toISOString().split('T')[0];
        const record = this.stats.history[today];

        document.getElementById('final-time').textContent = record.time;
        document.getElementById('final-moves').textContent = record.moves;

        // Disable reset button for daily
        document.getElementById('reset-btn').disabled = true;
        document.getElementById('play-again-btn').textContent = "Back to Game";

        setTimeout(() => {
            this.updateStatsUI();
            this.winModal.classList.remove('hidden');
            document.querySelector('#win-modal h2').textContent = "Daily Completed!";
        }, 500);
    }

    updateStatsUI() {
        document.getElementById('current-streak').textContent = this.stats.currentStreak;
        document.getElementById('max-streak').textContent = this.stats.maxStreak;

        const historyChart = document.getElementById('history-chart');
        historyChart.innerHTML = '';

        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            last7Days.push(d.toISOString().split('T')[0]);
        }

        last7Days.forEach(date => {
            const container = document.createElement('div');
            container.className = 'chart-bar-container';

            const bar = document.createElement('div');
            bar.className = 'chart-bar';

            if (this.stats.history[date]) {
                bar.classList.add('filled');
                // Height based on time or just fixed for "completed"
                bar.style.height = '100%';
            } else {
                bar.style.height = '10%';
            }

            const label = document.createElement('span');
            label.className = 'chart-label';
            label.textContent = date.split('-')[2]; // Just the day

            container.appendChild(bar);
            container.appendChild(label);
            historyChart.appendChild(container);
        });
    }

    startCountdown() {
        if (this.countdownInterval) clearInterval(this.countdownInterval);

        const update = () => {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);

            const diff = tomorrow - now;
            const hours = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
            const seconds = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, '0');

            const str = `${hours}:${minutes}:${seconds}`;
            document.getElementById('win-countdown').textContent = str;
            document.getElementById('modal-countdown').textContent = str;
        };

        update();
        this.countdownInterval = setInterval(update, 1000);
    }

    toggleStats(show) {
        if (show) {
            this.updateStatsUI();
            this.statsModal.classList.remove('hidden');
        } else {
            this.statsModal.classList.add('hidden');
        }
    }

    reset() {
        if (this.isDailyCompleted) {
            this.winModal.classList.add('hidden');
            this.selectedShelfIndex = null;
            this.render();
            return;
        }

        this.moves = 0;
        this.selectedShelfIndex = null;
        this.isWon = false;
        this.winModal.classList.add('hidden');
        this.init();
    }

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.startTime = Date.now();
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const seconds = (elapsed % 60).toString().padStart(2, '0');
            this.timerDisplay.textContent = `${minutes}:${seconds}`;
        }, 1000);
    }

    toggleTutorial(show) {
        if (show) {
            this.tutorialModal.classList.remove('hidden');
        } else {
            this.tutorialModal.classList.add('hidden');
        }
    }
}

// Start the game when the page loads
window.onload = () => {
    new Game();
};
