const RED_PLAYER = "red";
const GREEN_PLAYER = "green";

function GameManager(size, InputManager, Actuator, StorageManager, isPlayWithBot) {
  this.size = size; // Size of the grid
  this.inputManager = new InputManager;
  this.storageManager = new StorageManager;
  this.actuator = new Actuator;

  this.startTiles = 1;

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.turn = GREEN_PLAYER;
  this.maxRed = 0;
  this.maxGreen = 0;
  this.redScore = 0;
  this.greenScore = 0;
  this.winner = null;
  this.isPlayWithBot = isPlayWithBot;
  this.redScoreChange = 0;
  this.greenScoreChange = 0;

  this.setup();
}

function copy(state) {
  var game = Object.create(GameManager.prototype);
  game.size = state.size;
  game.grid = new Grid(state.size, state.grid.cells);
  game.over = state.over;
  game.won = state.won;
  game.turn = state.turn;
  game.redScore = state.redScore;
  game.greenScore = state.greenScore;
  game.maxRed = state.maxRed;
  game.maxGreen = state.maxGreen;
  game.winner = state.winner;
  game.redScoreChange = state.redScoreChange;
  game.greenScoreChange = state.greenScoreChange;
  game.isPlayWithBot = state.isPlayWithBot;
  return game;
}

GameManager.prototype.storageKey = function () {
  return this.isPlayWithBot ? "gameStateBot" : "gameState";
};

// Restart the game
GameManager.prototype.restart = function () {
  this.storageManager.clearGameState(this.storageKey());
  this.actuator.continueGame(); // Clear the game won/lost message
  this.setup();
};

// Return true if the game is lost, or has won and the user hasn't kept playing
GameManager.prototype.isGameTerminated = function () {
  return this.over || this.winner;
};

// Set up the game
GameManager.prototype.setup = function () {
  var previousState = this.storageManager.getGameState(this.storageKey());

  // Reload the game from a previous game if present
  if (previousState) {
    this.grid = new Grid(previousState.grid.size,
      previousState.grid.cells); // Reload grid
    this.over = previousState.over;
    this.won = previousState.won;
    this.turn = previousState.turn;
    this.redScore = previousState.redScore;
    this.greenScore = previousState.greenScore;
    this.maxRed = previousState.maxRed;
    this.maxGreen = previousState.maxGreen;
    this.winner = previousState.winner;
    this.redScoreChange = previousState.redScoreChange;
    this.greenScoreChange = previousState.greenScoreChange;
    this.isPlayWithBot = previousState.isPlayWithBot;
    if (this.isBotTurn()) {
      setTimeout(() => {
        this.botMove();
      }, 900);
    }
  } else {
    this.grid = new Grid(this.size);
    this.over = false;
    this.won = false;
    this.turn = GREEN_PLAYER;
    this.redScore = 0;
    this.greenScore = 0;
    this.maxRed = 0;
    this.maxGreen = 0;
    this.winner = null;
    this.redScoreChange = 0;
    this.greenScoreChange = 0;

    // Add the initial tiles
    this.addStartTiles();
  }

  // Update the actuator
  this.actuate();
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) {
    this.addRandomTile(RED_PLAYER);
    this.addRandomTile(GREEN_PLAYER);
  }
};

// Adds a tile in a random position
GameManager.prototype.addRandomTile = function (player) {
  if (this.grid.cellsAvailable()) {
    var value = Math.random() < 0.9 ? 2 : 4;
    var tile = new Tile(this.grid.randomAvailableCell(), value, player);

    this.grid.insertTile(tile);
  }
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  // Clear the state when the game is over (game over only, not win)
  if (this.over) {
    this.storageManager.clearGameState(this.storageKey());
  } else {
    this.storageManager.setGameState(this.storageKey(), this.serialize());
  }

  this.actuator.actuate(this.grid, {
    over: this.over,
    won: this.won,
    terminated: this.isGameTerminated(),
    turn: this.turn,
    redScore: this.redScore,
    greenScore: this.greenScore,
    winner: this.winner,
    maxRed: this.maxRed,
    maxGreen: this.maxGreen,
    redScoreChange: this.redScoreChange,
    greenScoreChange: this.greenScoreChange,
    isPlayWithBot: this.isPlayWithBot
  });

};

// Represent the current game as an object
GameManager.prototype.serialize = function () {
  return {
    size: this.size,
    grid: this.grid.serialize(),
    over: this.over,
    won: this.won,
    turn: this.turn,
    redScore: this.redScore,
    greenScore: this.greenScore,
    maxRed: this.maxRed,
    maxGreen: this.maxGreen,
    winner: this.winner,
    redScoreChange: this.redScoreChange,
    greenScoreChange: this.greenScoreChange,
    isPlayWithBot: this.isPlayWithBot
  };
};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

GameManager.prototype.switchTurn = function () {
  this.turn = this.turn === RED_PLAYER ? GREEN_PLAYER : RED_PLAYER;
};
// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction, force = false) {
  if (force === false && this.isBotTurn()) return;
  if (direction === -1) return;
  this.redScoreChange = this.redScore;
  this.greenScoreChange = this.greenScore;
  // 0: up, 1: right, 2: down, 3: left
  var self = this;

  if (this.isGameTerminated()) return; // Don't do anything if the game's over

  var cell, tile;

  var vector = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved = false;

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = {x: x, y: y};
      tile = self.grid.cellContent(cell);

      if (tile) {
        var positions = self.findFarthestPosition(cell, vector);
        var next = self.grid.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && next.value === tile.value && !next.mergedFrom) {
          var merged = new Tile(positions.next, tile.value * 2, self.turn);
          merged.mergedFrom = [tile, next];

          self.grid.insertTile(merged);
          self.grid.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          self.score += merged.value;
          if (self.turn === RED_PLAYER) {
            self.redScore += merged.value;
          } else if (self.turn === GREEN_PLAYER) {
            self.greenScore += merged.value;
          }

          // The mighty 2048 tile
          if (merged.value === 2048) {
            if (self.turn === GREEN_PLAYER) {
              self.winner = GREEN_PLAYER;
            } else {
              self.winner = RED_PLAYER;
            }
            self.won = true;
          }
        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });

  if (moved) {
    this.addRandomTile(this.turn);
    // reset maxRed and maxGreen
    this.maxRed = 0;
    this.maxGreen = 0;
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        let ele = this.grid.cells[i][j];
        if (ele && ele.player === RED_PLAYER && ele.value > this.maxRed) {
          this.maxRed = ele.value;
        }
        if (ele && ele.player === GREEN_PLAYER && ele.value > this.maxGreen) {
          this.maxGreen = ele.value;
        }
      }
    }

    this.redScoreChange = this.redScore - this.redScoreChange;
    this.greenScoreChange = this.greenScore - this.greenScoreChange;

    if (!this.movesAvailable()) {
      if (this.maxGreen > this.maxRed) {
        this.winner = GREEN_PLAYER;
      } else if (this.maxGreen < this.maxRed) {
        this.winner = RED_PLAYER;
      } else {
        if (this.redScore > this.greenScore) {
          this.winner = RED_PLAYER;
        } else if (this.redScore < this.greenScore) {
          this.winner = GREEN_PLAYER;
        } else {
          this.winner = "draw";
        }
      }

      this.over = true; // Game over!
    }

    this.switchTurn();

    this.actuate();
    if (this.isBotTurn()) {
      setTimeout(() => {
        this.botMove();
      }, 900);
    }
  }
};

GameManager.prototype.simulateMove = function (direction) {
  this.redScoreChange = this.redScore;
  this.greenScoreChange = this.greenScore;
  // 0: up, 1: right, 2: down, 3: left
  var self = this;

  if (this.isGameTerminated()) return; // Don't do anything if the game's over

  var cell, tile;

  var vector = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved = false;

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = {x: x, y: y};
      tile = self.grid.cellContent(cell);

      if (tile) {
        var positions = self.findFarthestPosition(cell, vector);
        var next = self.grid.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && next.value === tile.value && !next.mergedFrom) {
          var merged = new Tile(positions.next, tile.value * 2, self.turn);
          merged.mergedFrom = [tile, next];

          self.grid.insertTile(merged);
          self.grid.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          self.score += merged.value;
          if (self.turn === RED_PLAYER) {
            self.redScore += merged.value;
          } else if (self.turn === GREEN_PLAYER) {
            self.greenScore += merged.value;
          }

          // The mighty 2048 tile
          if (merged.value === 2048) {
            if (self.turn === GREEN_PLAYER) {
              self.winner = GREEN_PLAYER;
            } else {
              self.winner = RED_PLAYER;
            }
            self.won = true;
          }
        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });

  if (moved) {
    this.addRandomTile(this.turn);
    // reset maxRed and maxGreen
    this.maxRed = 0;
    this.maxGreen = 0;
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        let ele = this.grid.cells[i][j];
        if (ele && ele.player === RED_PLAYER && ele.value > this.maxRed) {
          this.maxRed = ele.value;
        }
        if (ele && ele.player === GREEN_PLAYER && ele.value > this.maxGreen) {
          this.maxGreen = ele.value;
        }
      }
    }

    this.redScoreChange = this.redScore - this.redScoreChange;
    this.greenScoreChange = this.greenScore - this.greenScoreChange;

    if (!this.movesAvailable()) {
      if (this.maxGreen > this.maxRed) {
        this.winner = GREEN_PLAYER;
      } else if (this.maxGreen < this.maxRed) {
        this.winner = RED_PLAYER;
      } else {
        if (this.redScore > this.greenScore) {
          this.winner = RED_PLAYER;
        } else if (this.redScore < this.greenScore) {
          this.winner = GREEN_PLAYER;
        } else {
          this.winner = "draw";
        }
      }

      this.over = true; // Game over!
    }
    this.switchTurn();
  }
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    0: {x: 0, y: -1}, // Up
    1: {x: 1, y: 0},  // Right
    2: {x: 0, y: 1},  // Down
    3: {x: -1, y: 0}   // Left
  };

  return map[direction];
};

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (vector) {
  var traversals = {x: [], y: []};

  for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};

GameManager.prototype.findFarthestPosition = function (cell, vector) {
  var previous;

  // Progress towards the vector direction until an obstacle is found
  do {
    previous = cell;
    cell = {x: previous.x + vector.x, y: previous.y + vector.y};
  } while (this.grid.withinBounds(cell) &&
  this.grid.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
};

GameManager.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
GameManager.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = this.grid.cellContent({x: x, y: y});

      if (tile) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = self.getVector(direction);
          var cell = {x: x + vector.x, y: y + vector.y};

          var other = self.grid.cellContent(cell);

          if (other && other.value === tile.value) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

GameManager.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};

GameManager.prototype.isBotTurn = function () {
  return this.isPlayWithBot && this.turn === RED_PLAYER;
};
GameManager.prototype.calculateGridPossibleScore = function () {
  let score = 0;
  let tile;
  let nextTile;
  for (let row = 0; row < this.size; row++) {
    if (row + 1 < this.size) {
      for (let col = 0; col < this.size; col++) {
        tile = this.grid.cellContent({x: row, y: col});
        nextTile = this.grid.cellContent({x: row + 1, y: col});
        if (tile && nextTile && tile.value === nextTile.value) {
          score += this.grid.cells[row][col].value * 2 * 300;
        }
      }
    }
  }
  for (let col = 0; col < this.size; col++) {
    if (col + 1 < this.size) {
      for (let row = 0; row < this.size; row++) {
        tile = this.grid.cellContent({x: row, y: col});
        nextTile = this.grid.cellContent({x: row, y: col + 1});
        if (tile && nextTile && tile.value === nextTile.value) {
          score += this.grid.cells[row][col].value * 2 * 300;
        }
      }
    }
  }
  return score;
};


GameManager.prototype.botMove = function () {
  if (this.isBotTurn()) {
    let initialState = this.serialize();
    let bestDirection = -1;
    let currentBotScore = this.maxRed * 300 + this.redScore;
    let currentUserScore = this.maxGreen * 300 + this.greenScore;
    let bestScore = currentBotScore - currentUserScore - this.calculateGridPossibleScore();
    let canMove = [true, true, true, true];
    for (let direction = 0; direction < 4; direction++) {
      let newGame = copy(initialState);
      newGame.simulateMove(direction);
      if (newGame.isBotTurn()) {
        canMove[direction] = false;
        continue;
      }
      let botScore = newGame.maxRed * 300 + newGame.redScore;
      let userScore = newGame.maxGreen * 300 + newGame.greenScore;
      let newScore =
        botScore - userScore - newGame.calculateGridPossibleScore();
      if (newScore > bestScore) {
        bestDirection = direction;
        bestScore = newScore;
      }
    }
    if (bestDirection !== -1) {
      this.move(bestDirection, true);
    } else {
      for (let i = 0; i < this.size; i++) {
        if (canMove[i]) {
          this.move(i, true);
          return;
        }
      }
    }
  }
};
