function parsedots(path){
	return (path || '').replace(/[\.\/]/g, '~');
}

function getdots(path){
	return (path || '').replace(/\~/g, '.');
}

function getslashes(path){
	return (path || '').replace(/\~/g, '/');
}

function levelrange(start, end){
	return {
		keyEncoding:'ascii',
		start:start,
		end:end + '\xff'
	}
}

function bookingkey(path, id){
	return 'booking.' + path + '.' + id;
}

function schedulekey(path, id, time){
	return 'schedule.' + path + '._booking.' + time + '.' + id;
}

function querykeys(path, starttime, endtime){

	var schedule_key = 'schedule.' + path + '.booking';

	var start = schedule_key;
	var end = schedule_key;
	var inclusive = false;

	if(window){
		start += '.' + window.start;
		end += '.' + window.end;
		inclusive = window.inclusive;
	}
	else{
		end += '\xff';
	}

	return {
		start:parsedots(start),
		end:parsedots(end)
	}
}

module.exports = {
	bookingkey:bookingkey,
	schedulekey:schedulekey,
	parsedots:parsedots,
	getdots:getdots,
	querykeys:querykeys,
	levelrange:levelrange
}