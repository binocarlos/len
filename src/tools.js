function levelrange(start, end){
	return {
		keyEncoding:'ascii',
		start:start,
		end:end + '\xff'
	}
}

// floor or ceil the timestamp to the closest day
function day_timestamp(stamp, end){
	var d = new Date(stamp);

	d.setHours(0);
	d.setMinutes(0);
	d.setHours(0);

	var t = d.getTime();

	if(end){
		t += (60*60*24*1000);
	}
	
	return t;
}

function pad_timestamp(stamp){
	while(stamp.length<13){
		stamp = '0' + stamp;
	}
	return stamp;
}

function bookingkey(path, id){
	return '_b.' + path + '.' + id;
}

function schedulekey(path, id, time){
	return '_s.' + path + '._.' + pad_timestamp(time) + '.' + id;
}

function querykeys(path, window){

	var schedule_key = '_s.' + path + '._.';

	var start = schedule_key;
	var end = schedule_key;
	var inclusive = false;

	if(window){
		start += window.start;
		end += window.end;
		inclusive = window.inclusive;
	}
	else{
		end += '\xff';
	}

	return {
		start:start,
		end:end
	}
}

module.exports = {
	day_timestamp:day_timestamp,
	pad_timestamp:pad_timestamp,
	bookingkey:bookingkey,
	schedulekey:schedulekey,
	querykeys:querykeys,
	levelrange:levelrange
}