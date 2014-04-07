var EventEmitter = require('events').EventEmitter
var util = require('util')
var tools = require('./tools');

function Schedule(db){
	var self = this

	EventEmitter.call(this)

	this._db = db;
}

util.inherits(Schedule, EventEmitter)

module.exports = Schedule;

Schedule.prototype.keys = function(path, id, start, end){
	var parts = path.split('.');
	var keys = [];

	while(parts.length>0){
		var usepath = parts.join('.');

		var startpath = tools.schedulekey(usepath, id, start);
		var endpath = tools.schedulekey(usepath, id, end);

		keys.push({
			path:startpath,
			type:'start'
		})

		keys.push({
			path:endpath,
			type:'end'
		})

		parts.pop();
	}

	return keys;
}

Schedule.prototype.add = function(path, id, start, end, callback){
	this._db.batch(this.addBatch(path, id, start, end), callback);
}

Schedule.prototype.remove = function(path, id, start, end, callback){
	this._db.batch(this.removeBatch(path, id, start, end), callback);
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
Schedule.prototype.addBatch = function(path, id, start, end){
	var keys = this.keys(path, id, start, end);

	return keys.map(function(key){
		return {
			type:'put',
			key:key.path,
			value:path + '.' + id + ':' + key.type
		}
	})
}

Schedule.prototype.removeBatch = function(path, id, start, end){
	var keys = this.keys(path, id, start, end);

	return keys.map(function(key){
		return {
			type:'del',
			key:key.path
		}
	})
}