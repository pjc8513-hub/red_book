const COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];
const CAPACITY = 7;
const BOOKS_PER_COLOR = 6;
const SHELF_COUNT = 6;

class Editor {
    constructor() {
        this.shelves = Array.from({ length: SHELF_COUNT }, () => []);
        this.selectedColor = null;
        this.init();
    }

    init() {
        this.setupDOM();
        this.setupPalette();
        this.render();
    }

    setupDOM() {
        this.shelfArea = document.getElementById('bookshelf-area');
        this.statusDisplay = document.getElementById('status-display');
        this.jsonOutput = document.getElementById('json-output');
        this.outputArea = document.getElementById('output-area');

        document.getElementById('check-solvability').onclick = () => this.checkSolvability();
        document.getElementById('random-btn').onclick = () => this.generateRandom();
        document.getElementById('export-btn').onclick = () => this.exportPuzzle();
        document.getElementById('back-to-game').onclick = () => window.location.href = 'index.html';
    }

    setupPalette() {
        const palette = document.getElementById('color-palette');
        COLORS.forEach(color => {
            const item = document.createElement('div');
            item.className = 'palette-item';
            item.style.backgroundImage = `url('assets/images/${color}_book.webp')`;
            item.onclick = () => {
                document.querySelectorAll('.palette-item').forEach(p => p.classList.remove('selected'));
                item.classList.add('selected');
                this.selectedColor = color;
                this.statusDisplay.textContent = `Selected: ${color}`;
            };
            palette.insertBefore(item, palette.querySelector('.eraser'));
        });

        const eraser = document.querySelector('.eraser');
        eraser.onclick = () => {
            document.querySelectorAll('.palette-item').forEach(p => p.classList.remove('selected'));
            eraser.classList.add('selected');
            this.selectedColor = 'erase';
            this.statusDisplay.textContent = `Selected: Eraser`;
        };
    }

    handleShelfClick(index) {
        if (!this.selectedColor) {
            this.statusDisplay.textContent = "Please select a color first!";
            return;
        }

        if (this.selectedColor === 'erase') {
            if (this.shelves[index].length > 0) {
                this.shelves[index].pop();
            }
        } else {
            if (this.shelves[index].length < CAPACITY) {
                // Check if color count is exceeded
                const count = this.shelves.flat().filter(c => c === this.selectedColor).length;
                if (count < BOOKS_PER_COLOR) {
                    this.shelves[index].push(this.selectedColor);
                } else {
                    this.statusDisplay.textContent = `Max ${BOOKS_PER_COLOR} books of each color allowed!`;
                }
            }
        }
        this.render();
    }

    render() {
        this.shelfArea.innerHTML = '';
        this.shelves.forEach((books, index) => {
            const shelfContainer = document.createElement('div');
            shelfContainer.className = `shelf-container`;
            shelfContainer.onclick = () => this.handleShelfClick(index);

            const booksStack = document.createElement('div');
            booksStack.className = 'books-stack';

            books.forEach((color, bookIdx) => {
                const book = document.createElement('div');
                book.className = 'book';
                book.style.backgroundImage = `url('assets/images/${color}_book.webp')`;
                booksStack.appendChild(book);
            });

            const shelfImage = document.createElement('div');
            shelfImage.className = 'shelf-image';

            shelfContainer.appendChild(booksStack);
            shelfContainer.appendChild(shelfImage);
            this.shelfArea.appendChild(shelfContainer);
        });
    }

    generateRandom() {
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

        this.statusDisplay.textContent = "Random puzzle generated! You can now fine-tune it.";
        this.statusDisplay.style.color = "white";
        this.render();
    }

    checkSolvability() {
        const totalBooks = this.shelves.flat().length;
        const expectedTotal = COLORS.length * BOOKS_PER_COLOR;

        if (totalBooks !== expectedTotal) {
            this.statusDisplay.textContent = `Incomplete puzzle! Need ${expectedTotal} books (current: ${totalBooks})`;
            return;
        }

        // Verify we have exactly BOOKS_PER_COLOR of each color
        for (const color of COLORS) {
            const count = this.shelves.flat().filter(c => c === color).length;
            if (count !== BOOKS_PER_COLOR) {
                this.statusDisplay.textContent = `Invalid puzzle! Each color must have exactly ${BOOKS_PER_COLOR} books.`;
                return;
            }
        }

        this.statusDisplay.textContent = "Checking solvability...";

        // Use setTimeout to allow UI to update
        setTimeout(() => {
            const isSolvable = this.solve(this.shelves);
            if (isSolvable) {
                this.statusDisplay.textContent = "✅ SOLVABLE!";
                this.statusDisplay.style.color = "#0f0";
            } else {
                this.statusDisplay.textContent = "❌ UNSOLVABLE!";
                this.statusDisplay.style.color = "#f00";
            }
        }, 100);
    }

    // Solver logic
    solve(initialShelves) {
        const visited = new Set();
        const queue = [this.serialize(initialShelves)];
        visited.add(queue[0]);

        let head = 0;
        while (head < queue.length) {
            const currentStateSerialized = queue[head++];
            const currentState = this.deserialize(currentStateSerialized);

            if (this.isWinState(currentState)) {
                return true;
            }

            const nextStates = this.getNextStates(currentState);
            for (const state of nextStates) {
                const serialized = this.serialize(state);
                if (!visited.has(serialized)) {
                    visited.add(serialized);
                    queue.push(serialized);
                }
            }

            // Safety break for extremely large search space (though sorting helps a lot)
            if (queue.length > 50000) {
                console.warn("Search limit reached");
                return false;
            }
        }

        return false;
    }

    serialize(shelves) {
        // Sort shelves to make identical states hash the same way
        return [...shelves].map(s => s.join(',')).sort().join('|');
    }

    deserialize(str) {
        if (!str) return Array.from({ length: SHELF_COUNT }, () => []);
        return str.split('|').map(s => s ? s.split(',') : []);
    }

    isWinState(shelves) {
        const occupiedShelves = shelves.filter(s => s.length > 0);
        if (occupiedShelves.length !== COLORS.length) return false;

        return occupiedShelves.every(shelf => {
            if (shelf.length !== BOOKS_PER_COLOR) return false;
            const firstColor = shelf[0];
            return shelf.every(color => color === firstColor);
        });
    }

    getNextStates(shelves) {
        const states = [];
        for (let i = 0; i < shelves.length; i++) {
            if (shelves[i].length === 0) continue;

            const volume = this.getVolume(shelves, i);
            for (let j = 0; j < shelves.length; j++) {
                if (i === j) continue;
                if (this.canMove(shelves, i, j, volume)) {
                    const newState = shelves.map(s => [...s]);
                    for (let k = 0; k < volume.count; k++) {
                        newState[j].push(newState[i].pop());
                    }
                    states.push(newState);
                }
            }
        }
        return states;
    }

    getVolume(shelves, index) {
        const shelf = shelves[index];
        const color = shelf[shelf.length - 1];
        let count = 0;
        for (let i = shelf.length - 1; i >= 0; i--) {
            if (shelf[i] === color) count++;
            else break;
        }
        return { color, count };
    }

    canMove(shelves, from, to, volume) {
        const targetShelf = shelves[to];
        if (targetShelf.length + volume.count > CAPACITY) return false;
        if (targetShelf.length === 0) return true;
        return targetShelf[targetShelf.length - 1] === volume.color;
    }

    exportPuzzle() {
        const date = new Date().toISOString().split('T')[0];
        const puzzleData = {
            [date]: this.shelves
        };
        this.jsonOutput.textContent = JSON.stringify(puzzleData, null, 2);
        this.outputArea.style.display = 'block';
    }
}

new Editor();
