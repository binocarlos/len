var datefloor = require('date-floor');

function levelrange(start, end){
	return {
		keyEncoding:'ascii',
		start:start,
		end:end + '\xff'
	}
}

// floor or ceil the timestamp to the closest day
function day_timestamp(stamp, end){
	var t = datefloor(stamp, 'day').getTime();

	if(end){
		t += 60*60*24*1000;
	}

	return t;
}

function pad_timestamp(stamp){
	while(stamp.length<13){
		stamp = '0' + stamp;
	}
	return stamp;
}

function querykeys(path, window){

	if(!path){
		return {
			start:'_s._.',
			end:'_s._.\xff',
		}
	}
	
	var schedule_key = '_s.' + path + '._.';

	var start = schedule_key;
	var end = schedule_key;
	var inclusive = false;

	if(window){
		if(window.start){
			start += window.start;	
		}
		
		if(window.end){
			end += window.end;	
		}
		else{
			end += '\xff';
		}
		
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


function littleid(chars){

  chars = chars || 6;

  var pattern = '';

  for(var i=0; i<chars; i++){
    pattern += 'x';
  }
  
  return pattern.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

module.exports = {
	littleid:littleid,
	day_timestamp:day_timestamp,
	pad_timestamp:pad_timestamp,
	querykeys:querykeys,
	levelrange:levelrange
}