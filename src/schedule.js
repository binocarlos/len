var EventEmitter = require('events').EventEmitter
var util = require('util')
var tools = require('./tools');
var datefloor = require('date-floor');
var timestampseries = require('timestamp-series');

function Schedule(db){
	var self = this

	EventEmitter.call(this)

	this._db = db;
}

util.inherits(Schedule, EventEmitter)

module.exports = Schedule;

// return the keys for a path such that each start and end is written to each level in the path
Schedule.prototype.ancestorkeys = function(path, start, end, id){
	var parts = path.split('.');
	var keys = [];

	function add_key(usepath){
		var startpath = tools.schedulekey(usepath, start, id);
		var endpath = tools.schedulekey(usepath, end, id);

		keys.push({
			path:startpath,
			type:'start'
		})

		keys.push({
			path:endpath,
			type:'end'
		})
	}

	while(parts.length>0){
		var usepath = parts.join('.');

		add_key(usepath);

		parts.pop();
	}

	add_key('');

	return keys;
}


// return an array of timestamps that are one per day (inclusive of end days) for a range
Schedule.prototype.daykeys = function(path, start, end){

	var startday = datefloor(start, 'day');
	var endday = datefloor(start, 'day');

	return timestampseries('day', start, end).map(function(day_timestamp){

	})
}

Schedule.prototype.add = function(path, start, end, callback){
	this._db.batch(this.addBatch(path, start, end), callback);
}

Schedule.prototype.remove = function(path, start, end, callback){
	this._db.batch(this.removeBatch(path, start, end), callback);
}

// this is where we create several entries per booking so that we can query
// the layers efficiently
//
// booking id = 10, start = 40, end = 50, path = a.b.c
//
// a._booking.40.10
// a.b._booking.40.10
// a.b.c._booking.40.10
// a._booking.50.10
// a.b._booking.50.10
// a.b.c._booking.50.10
//
// would all be created
Schedule.prototype.addBatch = function(path, start, end, id){
	var ancestorkeys = this.ancestorkeys(path, start, end, id);

	var ancestorinserts = ancestorkeys.map(function(key){
		return {
			type:'put',
			key:key.path,
			value:path + '.' + id + ':' + key.type
		}
	})

/*
	var dayinserts = ancestorkeys.map(function(key){
		return {
			type:'put',
			key:key.path,
			value:path + '.' + id + ':' + key.type
		}
	})

	var allinserts = [].concat(ancestorinserts);
	*/
	return ancestorinserts;
}

Schedule.prototype.removeBatch = function(path, start, end, id){
	var ancestorkeys = this.ancestorkeys(path, start, end, id);

	var ancestordels = ancestorkeys.map(function(key){
		return {
			type:'del',
			key:key.path
		}
	})

	var alldels = [].concat(ancestordels);
	return alldels;
}