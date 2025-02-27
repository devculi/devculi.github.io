function HTMLActuator() {
  this.tileContainer = document.querySelector(".tile-container");
  this.messageContainer = document.querySelector(".game-message");

  this.maxRed = 0;
  this.redScore = 0;
  this.maxGreen = 0;
  this.greenScore = 0;
}

HTMLActuator.prototype.actuate = function (grid, metadata) {
  var self = this;

  window.requestAnimationFrame(function () {
    self.clearContainer(self.tileContainer);

    grid.cells.forEach(function (column) {
      column.forEach(function (cell) {
        if (cell) {
          self.addTile(cell);
        }
      });
    });

    self.updateScore(metadata.maxRed, metadata.redScore, RED_PLAYER, metadata.redScoreChange);
    self.updateScore(metadata.maxGreen, metadata.greenScore, GREEN_PLAYER, metadata.greenScoreChange);

    if (metadata.terminated) {
      if (metadata.over) {
        self.message(false, metadata); // when the game is over
      } else if (metadata.won) {
        self.message(true, metadata); // when one player gets 2048
      }
    }

    let redTurnTxtContainer = document.querySelector(".red-txt-container");
    let greenTurnTxtContainer = document.querySelector(".green-txt-container");
    if (metadata.turn === RED_PLAYER) {
      redTurnTxtContainer.textContent = metadata.isPlayWithBot ? "Bot is thinking..." : "RED's Turn";
      greenTurnTxtContainer.textContent = " ";
    } else {
      redTurnTxtContainer.textContent = " ";
      greenTurnTxtContainer.textContent = metadata.isPlayWithBot ? "Your Turn" : "GREEN's Turn";
    }
  });
};

// Continues the game (both restart and keep playing)
HTMLActuator.prototype.continueGame = function () {
  this.clearMessage();
};

HTMLActuator.prototype.clearContainer = function (container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
};

HTMLActuator.prototype.addTile = function (tile) {
  var self = this;

  var wrapper = document.createElement("div");
  var inner = document.createElement("div");
  var position = tile.previousPosition || {x: tile.x, y: tile.y};
  var positionClass = this.positionClass(position);

  // We can't use classlist because it somehow glitches when replacing classes
  var classes = ["tile", "tile-" + tile.value + '-' + tile.player, positionClass];

  if (tile.value > 2048) classes.push("tile-super");

  this.applyClasses(wrapper, classes);

  inner.classList.add("tile-inner");
  inner.textContent = tile.value;

  if (tile.previousPosition) {
    // Make sure that the tile gets rendered in the previous position first
    window.requestAnimationFrame(function () {
      classes[2] = self.positionClass({x: tile.x, y: tile.y});
      self.applyClasses(wrapper, classes); // Update the position
    });
  } else if (tile.mergedFrom) {
    classes.push("tile-merged");
    this.applyClasses(wrapper, classes);

    // Render the tiles that merged
    tile.mergedFrom.forEach(function (merged) {
      self.addTile(merged);
    });
  } else {
    classes.push("tile-new");
    this.applyClasses(wrapper, classes);
  }

  // Add the inner part of the tile to the wrapper
  wrapper.appendChild(inner);

  // Put the tile on the board
  this.tileContainer.appendChild(wrapper);
};

HTMLActuator.prototype.applyClasses = function (element, classes) {
  element.setAttribute("class", classes.join(" "));
};

HTMLActuator.prototype.normalizePosition = function (position) {
  return {x: position.x + 1, y: position.y + 1};
};

HTMLActuator.prototype.positionClass = function (position) {
  position = this.normalizePosition(position);
  return "tile-position-" + position.x + "-" + position.y;
};

HTMLActuator.prototype.updateScore = function (maxScore, score, player, difference) {
  let scoreContainer = document.querySelector(`.scores-container-${player} .score-container`);
  this.clearContainer(scoreContainer);

  if (player === RED_PLAYER) {
    this.redScore = score;
    this.maxRed = maxScore;
    scoreContainer.textContent = `${this.maxRed}/${this.redScore}`;
  }

  if (player === GREEN_PLAYER) {
    this.greenScore = score;
    this.maxGreen = maxScore;
    scoreContainer.textContent = `${this.maxGreen}/${this.greenScore}`;
  }

  if (difference > 0) {
    var addition = document.createElement("div");
    addition.classList.add("score-addition");
    addition.textContent = "+" + difference;

    scoreContainer.appendChild(addition);
  }
};

HTMLActuator.prototype.message = function (won, metadata) {
  var type = won ? "game-won" : "game-over";
  var message = "Game over!";
  if (won) {
    if (metadata.winner === RED_PLAYER) message = "Red wins!";
    else if (metadata.winner === GREEN_PLAYER) message = "Green wins!";
  } else {
    if (metadata.maxRed > metadata.maxGreen) message = "Red wins!\nBiggest tile: " + metadata.maxRed;
    else if (metadata.maxRed < metadata.maxGreen) message = "Green wins!\nBiggest tile: " + metadata.maxGreen;
    else if (metadata.redScore > metadata.greenScore) message = "Red wins!\nScore: " + metadata.redScore;
    else if (metadata.redScore < metadata.greenScore) message = "Green wins!\nScore: " + metadata.greenScore;
    else message = "It's a draw!";
  }

  this.messageContainer.classList.add(type);
  this.messageContainer.getElementsByTagName("p")[0].textContent = message;
};

HTMLActuator.prototype.clearMessage = function () {
  // IE only takes one value to remove at a time.
  this.messageContainer.classList.remove("game-won");
  this.messageContainer.classList.remove("game-over");
};
