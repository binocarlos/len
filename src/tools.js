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
	return 'schedule.' + path + '.' + time + '.' + id;
}

function querykeys(path, starttime, endtime){
	path = parsedots(path + '.');
	var start = path;
	var end = path;
	if(starttime){
		start += starttime;
	}
	if(endtime){
		end += endtime;
	}
	return levelrange(start, end);
}

module.exports = {
	bookingkey:bookingkey,
	schedulekey:schedulekey,
	parsedots:parsedots,
	getdots:getdots,
	querykeys:querykeys,
	levelrange:levelrange
}