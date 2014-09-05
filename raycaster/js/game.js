var CIRCLE = Math.PI * 2;
var MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)

function Controls() {
  this.codes  = {
    // arrows
    38: 'forward', 40: 'backward',
    37: 'left', 39: 'right',

    // WASD
    87: 'forward', 83: 'backward',
    65: 'sideLeft', 68: 'sideRight',

    77: 'map'
  };

  this.states = {
    'forward': false, 'backward': false,
    'left': false, 'right': false,
    'sideLeft': false, 'sideRight': false,
    'map': false
  };

  document.addEventListener('keydown', this.onKey.bind(this, true), false);
  document.addEventListener('keyup', this.onKey.bind(this, false), false);
  document.addEventListener('touchstart', this.onTouch.bind(this), false);
  document.addEventListener('touchmove', this.onTouch.bind(this), false);
  document.addEventListener('touchend', this.onTouchEnd.bind(this), false);
  document.addEventListener('mousemove', this.onMouseMovement.bind(this), false);
  document.body.onclick =
    document.body.requestPointerLock ||
    document.body.mozRequestPointerLock ||
    document.body.webkitRequestPointerLock;
}

Controls.prototype.onTouch = function(e) {
  var t = e.touches[0];
  this.onTouchEnd(e);
  if (t.pageY < window.innerHeight * 0.5) this.onKey(true, { keyCode: 38 });
  else if (t.pageX < window.innerWidth * 0.5) this.onKey(true, { keyCode: 37 });
  else if (t.pageX > window.innerWidth * 0.5) this.onKey(true, { keyCode: 39 });
};

Controls.prototype.onTouchEnd = function(e) {
  this.states = {
    'forward': false, 'backward': false,
    'left': false, 'right': false,
    'sideLeft': false, 'sideRight': false
  };
  e.preventDefault();
  e.stopPropagation();
};

Controls.prototype.onKey = function(val, e) {
  var state = this.codes[e.keyCode];
  if (typeof state === 'undefined') return;
  this.states[state] = val;
  e.preventDefault && e.preventDefault();
  e.stopPropagation && e.stopPropagation();
};

Controls.prototype.onMouseMovement = function (e) {
  var x = (e.movementX || e.mozMovementX || e.webkitMovementX || 0);
  if(x > 0) { player.rotate(Math.PI / 40); }
  if(x < 0) { player.rotate(-Math.PI / 40); }
}

function Bitmap(src, width, height) {
  this.image = new Image();
  this.image.src = src;
  this.width = width;
  this.height = height;
}

function Player(options) {
  this.x = options.startX || 0;
  this.y = options.startY || 0;
  this.direction = options.direction || Math.PI * 1.51;
  this.weapon = options.weapon || new Bitmap('assets/knife_hand.png', 319, 320);
  this.paces = 0;
  this.steps = 0;
  this.distanceWalked = 0;
  this.lastStep = 0;
  this.isWalking = false;

  this.footsteps = [];
  this.footsteps.push(new Howl({
    urls: ['assets/footstep00.ogg'],
    volume:0.3
  }));
  this.footsteps.push(new Howl({
    urls: ['assets/footstep01.ogg'],
    volume:0.3
  }));
  this.breathing = new Howl({
    urls: ['assets/breathing.mp3'],
    volume: 0.15
  });

  // Start the breathing
  var that = this;
  var _playBreathing = function(){
    that.breathing.play();
    setTimeout(_playBreathing,4900);
  };
  _playBreathing();
}

Player.prototype.rotate = function(angle) {
  this.direction = (this.direction + angle + CIRCLE) % (CIRCLE);
};

Player.prototype.walk = function(distance, map, direction) {
  var dx = Math.cos(direction) * distance;
  var dy = Math.sin(direction) * distance;
  if (map.get(this.x + dx, this.y) <= 0) this.x += dx;
  if (map.get(this.x, this.y + dy) <= 0) this.y += dy;
  this.paces += distance;
  this.distanceWalked += Math.abs(distance);

  // modify SFX while walking
  clearTimeout(this.stopWalking);
  this.breathing.volume(0.3);
  this.isWalking = true;

  var that = this;
  this.stopWalking = setTimeout(function() {
    that.breathing.fadeOut(0.15, 3000);
    that.isWalking = false;
  }, 150);

  if(this.distanceWalked - this.lastStep > 1) {
    this.lastStep = this.distanceWalked;
    this.steps++;
    this.footsteps[this.steps % 2].play();
  }
};

Player.prototype.update = function(controls, map, seconds) {
  if (controls.left) this.rotate(-Math.PI * seconds);
  if (controls.right) this.rotate(Math.PI * seconds);
  if (controls.forward) this.walk(3 * seconds, map, this.direction);
  if (controls.backward) this.walk(-3 * seconds, map, this.direction);
  if (controls.sideLeft) this.walk(3 * seconds, map, this.direction - Math.PI/2);
  if (controls.sideRight) this.walk(-3 * seconds, map, this.direction - Math.PI/2);
};

function Map(player, options) {
  if(!options){ options = {}; }

  this.player = player;
  this.size = options.size || 32;
  this.wallGrid = options.wallGrid || Map.randomize(this.size);
  this.skybox = options.skybox || new Bitmap('assets/deathvalley_panorama.jpg', 2000, 750);
  this.wallTexture = options.wallTexture ||new Bitmap('assets/wall_texture.jpg', 1024, 1024);
  this.lightMin = options.lightMin || 0;
  this.lightMax = options.lightMax || 4;
  this.light = this.lightMin;
  this.weather = options.weather || false;
  this.disableMap = options.disableMap || false;
  this.showMap = options.showMap || false;
  
  // Spooky sound when too far away
  this.spooky = new Howl({
    urls: ['assets/forest.ogg'],
    onend: function() {
      this.spookyPlaying = false;
    }
  });
  this.wolf = new Howl({
    urls: ['assets/werewolf.mp3'],
    volume: 0.1
  })

  this.spookyPlaying = false;
  var that = this;
  var _playSpooky = function(){
    var range = MOBILE ? 8 : 14;
    if(
      that.player.x < -range ||
      that.player.x > that.size + range ||
      that.player.y < -range ||
      that.player.y > that.size + range
    ) {
      console.log("out of bounds");
      if(!that.spookyPlaying) {
        that.spooky.volume(1);
        that.spooky.play();
        that.spookyPlaying = true; 
      }

      if(Math.random() > 0.7) {
        that.wolf.play();
      }
    } else {
      that.spooky.fadeOut(0,1000);
    }
    setTimeout(_playSpooky,5000);
  };
  _playSpooky();

  this.thunder = [];
  this.rain;

  // If weather (storm) is enabled
  if(this.weather) {
    // Variety of thunder
    for(var i=1; i<=3; i++){
      this.thunder.push(new Howl({
        urls: ['assets/thunder'+i+'.mp3'],
        volume: 0.8
      }));
    }

    // Background rain
    this.rain = new Howl({
      urls: ['assets/rain.mp3'],
      loop: true,
      volume: 0.7
    }).play();
  }

}

Map.randomize = function(size) {
  var length = size * size;
  var wallGrid = new Uint8Array(length);
  for (var i = 0; i < length; i++) {
    wallGrid[i] = Math.random() < 0.3 ? 1 : 0;
  }
  return wallGrid;
};


Map.prototype.get = function(x, y) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || x > this.size - 1 || y < 0 || y > this.size - 1) return -1;
  return this.wallGrid[y * this.size + x];
};


Map.prototype.cast = function(point, angle, range) {
  var self = this;
  var sin = Math.sin(angle);
  var cos = Math.cos(angle);
  var noWall = { length2: Infinity };

  return ray({ x: point.x, y: point.y, height: 0, distance: 0 });

  function ray(origin) {
    var stepX = step(sin, cos, origin.x, origin.y);
    var stepY = step(cos, sin, origin.y, origin.x, true);
    var nextStep = stepX.length2 < stepY.length2
      ? inspect(stepX, 1, 0, origin.distance, stepX.y)
      : inspect(stepY, 0, 1, origin.distance, stepY.x);

    if (nextStep.distance > range) return [origin];
    return [origin].concat(ray(nextStep));
  }

  function step(rise, run, x, y, inverted) {
    if (run === 0) return noWall;
    var dx = run > 0 ? Math.floor(x + 1) - x : Math.ceil(x - 1) - x;
    var dy = dx * (rise / run);
    return {
      x: inverted ? y + dy : x + dx,
      y: inverted ? x + dx : y + dy,
      length2: dx * dx + dy * dy
    };
  }

  function inspect(step, shiftX, shiftY, distance, offset) {
    var dx = cos < 0 ? shiftX : 0;
    var dy = sin < 0 ? shiftY : 0;
    step.height = self.get(step.x - dx, step.y - dy);
    step.distance = distance + Math.sqrt(step.length2);
    if (shiftX) step.shading = cos < 0 ? 2 : 0;
    else step.shading = sin < 0 ? 2 : 1;
    step.offset = offset - Math.floor(offset);
    return step;
  }
};

Map.prototype.update = function(controls, seconds) {
  // toggle overview map
  if(!this.disableMap && controls.map) {
    this.showMap = !this.showMap;
    controls.map = false;
  }

  if(this.weather) {
    if (this.light > this.lightMin) {
      this.light = Math.max(this.light - 10 * seconds, this.lightMin);
    } else if (Math.random() * 5 < seconds) {
      this.light = this.lightMax;
      this.getThunder().play();
    }
  }
};

Map.prototype.getThunder = function() {
  var index = getRandomInt(0, this.thunder.length-1);
  return this.thunder[index];
}

function Camera(canvas, resolution, focalLength) {
  this.canvas = canvas;
  this.ctx = canvas.getContext('2d');
  this.width = canvas.width = window.innerWidth * 0.5;
  this.height = canvas.height = window.innerHeight * 0.5;
  this.resolution = resolution;
  this.spacing = this.width / resolution;
  this.focalLength = focalLength || 0.8;
  this.range = MOBILE ? 8 : 14;
  this.lightRange = 5;
  this.scale = (this.width + this.height) / 1200;
}

Camera.prototype.render = function(player, map) {
  this.drawSky(player.direction, map.skybox, map.light);
  this.drawColumns(player, map);
  this.drawWeapon(player.weapon, player.paces);

  if(map.showMap) {
    this.drawMap(0, 0, this.canvas.width * 0.2, map, player);
  }
};

Camera.prototype.drawSky = function(direction, sky, ambient) {
  var width = sky.width * (this.height / sky.height) * 2;
  var left = (direction / CIRCLE) * -width;

  this.ctx.save();
  this.ctx.drawImage(sky.image, left, 0, width, this.height);
  if (left < width - this.width) {
    this.ctx.drawImage(sky.image, left + width, 0, width, this.height);
  }
  if (ambient > 0) {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.globalAlpha = ambient * 0.1;
    this.ctx.fillRect(0, this.height * 0.5, this.width, this.height * 0.5);
  }
  this.ctx.restore();
};

Camera.prototype.drawMap = function(x, y, size, map, player) {
 // Draw the map
 var gridElementSize = size / map.size;
 for (var xx = 0; xx < map.size; xx++) {
   for (var yy = 0; yy < map.size; yy++) {
     var color = map.get(xx, yy) ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.5)";
     this.ctx.fillStyle = color;
     this.ctx.fillRect(x + xx * gridElementSize, y + yy * gridElementSize, gridElementSize, gridElementSize);
   }
 }
 // Draw the player field of view 
 var playerSize = gridElementSize * 0.7;
 var halfPlayerSize = playerSize * 0.5;
 var halfFOV = this.focalLength * 0.5;
 var sin = Math.sin(player.direction - halfFOV);
 var cos = Math.cos(player.direction - halfFOV);
 var range = this.range * gridElementSize;
 this.ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
 this.ctx.beginPath();
 xx = x + player.x * gridElementSize;
 yy = y + player.y * gridElementSize;
 this.ctx.moveTo(xx, yy);
 this.ctx.lineTo(xx + cos * range, yy + sin * range);
 sin = Math.sin(player.direction + halfFOV);
 cos = Math.cos(player.direction + halfFOV);
 this.ctx.lineTo(xx + cos * range, yy + sin * range);
 this.ctx.closePath();
 this.ctx.fill();
 this.ctx.arc(xx, yy, range, player.direction + halfFOV, player.direction - halfFOV, true);
 this.ctx.fill();
 // Draw the player
 this.ctx.fillStyle = "red";
 this.ctx.fillRect(x + player.x * gridElementSize - halfPlayerSize, y + player.y * gridElementSize - halfPlayerSize, playerSize, playerSize);
}

Camera.prototype.drawColumns = function(player, map) {
  this.ctx.save();
  for (var column = 0; column < this.resolution; column++) {
    var x = column / this.resolution - 0.5;
    var angle = Math.atan2(x, this.focalLength);
    var ray = map.cast(player, player.direction + angle, this.range);
    this.drawColumn(column, ray, angle, map);
  }
  this.ctx.restore();
};

Camera.prototype.drawColumn = function(column, ray, angle, map) {
  var ctx = this.ctx;
  var texture = map.wallTexture;
  var left = Math.floor(column * this.spacing);
  var width = Math.ceil(this.spacing);
  var hit = -1;

  while (++hit < ray.length && ray[hit].height <= 0);

  for (var s = ray.length - 1; s >= 0; s--) {
    var step = ray[s];

    if (s === hit) {
      var textureX = Math.floor(texture.width * step.offset);
      var wall = this.project(step.height, angle, step.distance);

      ctx.globalAlpha = 1;
      ctx.drawImage(texture.image, textureX, 0, 1, texture.height, left, wall.top, width, wall.height);
      
      ctx.fillStyle = '#000000';
      ctx.globalAlpha = Math.max((step.distance + step.shading) / this.lightRange - map.light, 0);
      ctx.fillRect(left, wall.top, width, wall.height);
    }

    if(map.weather) {
      var rainDrops = Math.pow(Math.random(), 3) * s;
      var rain = (rainDrops > 0) && this.project(0.1, angle, step.distance);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.15;
      while (--rainDrops > 0) ctx.fillRect(left, Math.random() * rain.top, 1, rain.height);
    }

    
  }
};

Camera.prototype.drawWeapon = function(weapon, paces) {
  var bobX = Math.cos(paces * 2) * this.scale * 6;
  var bobY = Math.sin(paces * 4) * this.scale * 6;
  var left = this.width * 0.66 + bobX;
  var top = this.height * 0.6 + bobY;
  this.ctx.drawImage(weapon.image, left, top, weapon.width * this.scale, weapon.height * this.scale);
};

Camera.prototype.project = function(height, angle, distance) {
  var z = distance * Math.cos(angle);
  var wallHeight = this.height * height / z;
  var bottom = this.height / 2 * (1 + 1 / z);
  return {
    top: bottom - wallHeight,
    height: wallHeight
  };
};

function GameLoop() {
  this.frame = this.frame.bind(this);
  this.lastTime = 0;
  this.callback = function() {};
}

GameLoop.prototype.start = function(callback) {
  this.callback = callback;
  requestAnimationFrame(this.frame);
};

GameLoop.prototype.frame = function(time) {
  var seconds = (time - this.lastTime) / 1000;
  this.lastTime = time;
  if (seconds < 0.2) this.callback(seconds);
  requestAnimationFrame(this.frame);
};

/**
 * Returns a random number between min (inclusive) and max (exclusive)
 */
function getRandom(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Returns a random integer between min (inclusive) and max (inclusive)
 * Using Math.round() will give you a non-uniform distribution!
 */
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Various map configurations
var levels = {};
levels.stormy = {
  lightMin: 0.75,
  lightMax: 4,
  startX: 15,
  startY: 32,
  weather: true
};

levels.sunny = {
  lightMin: 4,
  lightMax: 4,
  startX: 15,
  startY: 32
};

levels.simple = {
  size: 16,
  startX: 8,
  startY: 1,
  direction: Math.PI * 0.5,
  lightMin: 4,
  lightMax: 4,
};
levels.simple.wallGrid = [];
for(var i = 0; i < 16; i++) {
  for(var j = 0; j < 16; j++) {
    if(i === 8) {
      levels.simple.wallGrid.push(1.5);
    } else {
      levels.simple.wallGrid.push(0);
    }
  }
}


var level = levels.stormy;

var display = document.getElementById('display');
var player = new Player(level);
var map = new Map(player, level);
var controls = new Controls();
var camera = new Camera(display, MOBILE ? 160 : 320, 0.8);
var loop = new GameLoop();

loop.start(function frame(seconds) {
  map.update(controls, seconds);
  player.update(controls.states, map, seconds);
  camera.render(player, map);
});

