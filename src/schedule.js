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

// return an array of timestamps that are one per day (inclusive of end days) for a range
Schedule.prototype.daykeys = function(path, start, end){

	var startday = datefloor(start, 'day');
	var endday = datefloor(start, 'day');

	return timestampseries('day', start, end).map(function(day_timestamp){
		return '_d'
	})
}

Schedule.prototype.add = function(path, start, end, callback){
	this._db.batch(this.addBatch(path, start, end), callback);
}

Schedule.prototype.remove = function(path, start, end, callback){
	this._db.batch(this.removeBatch(path, start, end), callback);
}

Schedule.prototype.addBatch = function(booking){
	if(!booking.start || !booking.end){
		throw new Error('booking must have a start and an end');
	}

	var booking_string = JSON.stringify(booking || {});
	var booking_path = '_b.' + booking.path + '.' + booking.id;
	var tree_path = '_t.' + booking.path;

	var batch = [];
	
	// an entry in the tree so we can get descendents
	batch.push({
		type:'put',
		key:tree_path,
		value:booking_path
	})

	// the main booking entry
	batch.push({
		type:'put',
		key:booking_path,
		value:booking_string
	})

	batch.push({
		type:'put',
		key:'_s.' + booking.path + '.' + booking.start + '.' + booking.id,
		value:booking_path
	})

	batch.push({
		type:'put',
		key:'_s.' + booking.path + '.' + booking.end + '.' + booking.id,
		value:booking_path
	})

	var days = timestampseries('day', booking.start, booking.end);

	batch = batch.concat(days.map(function(day){
		return {
			type:'put',
			key:'_d.' + day + '.' + booking.path + '.' + booking.id,
			value:booking_path
		}
	}))

	return batch;
}

Schedule.prototype.removeBatch = function(booking){
	return this.addBatch(booking).map(function(entry){
		entry.type = 'del';
		delete(entry.value);
		return entry;
	})
}