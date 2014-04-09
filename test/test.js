var len = require('../src/index');
var level = require('level');
var concat = require('concat-stream');
var through = require('through');
var http = require('http');
var async = require('async');
var wrench = require('wrench');
var datefloor = require('date-floor');

var tools = require('../src/tools');

describe('len', function(){

  var leveldb;

  beforeEach(function(done){
    this.timeout(1000);
    wrench.rmdirSyncRecursive('/tmp/lentesttempdb', true);
    level('/tmp/lentesttempdb', {}, function(err, ldb){
      if (err) throw err
      leveldb = ldb
      done();
    });
  })

  afterEach(function(done){
    this.timeout(1000);
    leveldb.close(done);
  })

  describe('tools', function(){
    it('should get day timestamps', function(){

      var d = new Date('06/01/2014 11:00:00');

      var floor = new Date('06/01/2014 00:00:00');
      var ceil = new Date('06/02/2014 00:00:00');

      var testfloor = tools.day_timestamp(d.getTime());
      var testceil = tools.day_timestamp(d.getTime(), true);

      testfloor.should.equal(floor.getTime());
      testceil.should.equal(ceil.getTime());
    })


    it('should get a littleid', function(){

      var id = tools.littleid();

      id.length.should.equal(6);

    })

  })

  describe('constructor', function(){
  
    it('should be a function', function(){
      len.should.be.type('function');
    })

    it('should throw if no leveldb or options', function(){
      (function(){
        var lendb = len();
      }).should.throw('db required');
    })

    it('should create a lem server which should be an event emitter', function(done){
      var lendb = len(leveldb);

      lendb.on('apples', done);
      lendb.emit('apples');
    })

  })

  describe('bookings', function(){

    it('should save and load a booking', function(done){
      var lendb = len(leveldb);

      var start = new Date('01/03/2014 09:00:00');
      var end = new Date('01/03/2014 13:00:00');

      async.series([
        function(next){

          lendb.saveBooking('mechanics.bob', {
            id:10,
            start:start.getTime(),
            end:end.getTime(),
            meta:{
              name:'Fix car'
            }
          }, function(err){
            next(err);
          })
          
        },

        function(next){

          lendb.loadBooking('mechanics.bob', 10, function(err, booking){

            booking.path.should.equal('mechanics.bob');
            booking.id.should.equal(10);
            booking.meta.name.should.equal('Fix car');
            booking.start.should.equal(start.getTime());
            booking.end.should.equal(end.getTime());

            next();

          })
          
        }
      ], done)
      
    })


    it('should remove a booking', function(done){
      var lendb = len(leveldb);

      var start = new Date('01/03/2014 09:00:00');
      var end = new Date('01/03/2014 13:00:00');

      async.series([
        function(next){

          lendb.saveBooking('mechanics.bob', {
            id:10,
            start:start.getTime(),
            end:end.getTime(),
            meta:{
              name:'Fix car'
            }
          }, function(err){
            next(err);
          })
          
        },

        function(next){

          lendb.removeBooking('mechanics.bob', 10, next);

        },

        function(next){

          lendb.loadBooking('mechanics.bob', 10, function(err, booking){

            (booking===undefined).should.equal(true);

            next();

          })
          
        }
      ], done)
      
    })


    it('should update a booking', function(done){
      var lendb = len(leveldb);

      var start = new Date('01/03/2014 09:00:00');
      var end = new Date('01/03/2014 13:00:00');

      async.series([
        function(next){

          lendb.saveBooking('mechanics.bob', {
            id:10,
            start:start.getTime(),
            end:end.getTime(),
            meta:{
              name:'Fix car'
            }
          }, function(err){
            next(err);
          })
          
        },

        function(next){

          
          lendb.saveBooking('mechanics.bob', {
            id:10,
            start:start.getTime()+10,
            end:end.getTime(),
            meta:{
              name:'Fix car2'
            }
          }, function(err){
            next(err);
          })

        },

        function(next){

          lendb.loadBooking('mechanics.bob', 10, function(err, booking){

            booking.meta.name.should.equal('Fix car2');
            booking.start.should.equal(start.getTime()+10);

            next();

          })
          
        }
      ], done)
      
    })

  })


  describe('booking stream', function(){

    it('should fetch all bookings', function(done){

      var lendb = len(leveldb);

      var dates = {
        day1_morning:{
          start:new Date('03/01/2014 09:00:00'),
          end:new Date('03/01/2014 13:00:00')
        },
        day1_afternoon:{
          start:new Date('03/01/2014 13:30:00'),
          end:new Date('03/01/2014 18:00:00')
        },
        day2:{
          start:new Date('03/12/2014 09:30:00'),
          end:new Date('03/12/2014 18:00:00')
        }
      }


      async.series([
        function(next){

          lendb.saveBooking('mechanics.bob', {
            id:10,
            start:dates.day1_morning.start.getTime(),
            end:dates.day1_morning.end.getTime(),
            meta:{
              name:'day 1 morning'
            }
          }, next)
          
        },

        function(next){

          lendb.saveBooking('mechanics.bob', {
            id:11,
            start:dates.day1_afternoon.start.getTime(),
            end:dates.day1_afternoon.end.getTime(),
            meta:{
              name:'day 1 afternoon'
            }
          }, next)
        },

        function(next){

          lendb.saveBooking('mechanics.bob', {
            id:12,
            start:dates.day2.start.getTime(),
            end:dates.day2.end.getTime(),
            meta:{
              name:'day 2'
            }
          }, next)
        },

        function(next){

          var bookings = {};
          var bookingarr = [];
          lendb.createBookingStream().pipe(through(function(booking){

            bookings[booking.id] = booking;
            bookingarr.push(booking);
            
          }, function(){

            bookingarr.length.should.equal(3);
            bookingarr[0].id.should.equal(10);
            bookingarr[0].meta.name.should.equal('day 1 morning');
            bookingarr[1].id.should.equal(11);
            bookingarr[1].meta.name.should.equal('day 1 afternoon');
            bookingarr[2].id.should.equal(12);
            bookingarr[2].meta.name.should.equal('day 2');

            next();
          }))

        }
      ], done)

    })

    it('should fetch bookings in the correct time window', function(done){
      var lendb = len(leveldb);

      var dates = {
        day1_morning:{
          start:new Date('03/01/2014 09:00:00'),
          end:new Date('03/01/2014 13:00:00')
        },
        day1_afternoon:{
          start:new Date('03/01/2014 13:30:00'),
          end:new Date('03/01/2014 18:00:00')
        },
        day2:{
          start:new Date('03/12/2014 09:30:00'),
          end:new Date('03/12/2014 18:00:00')
        }
      }


      async.series([
        function(next){

          lendb.saveBooking('mechanics.bob', {
            id:10,
            start:dates.day1_morning.start.getTime(),
            end:dates.day1_morning.end.getTime(),
            meta:{
              name:'day 1 morning'
            }
          }, next)
          
        },

        function(next){

          lendb.saveBooking('mechanics.bob', {
            id:11,
            start:dates.day1_afternoon.start.getTime(),
            end:dates.day1_afternoon.end.getTime(),
            meta:{
              name:'day 1 afternoon'
            }
          }, next)
        },

        function(next){

          lendb.saveBooking('mechanics.bob', {
            id:12,
            start:dates.day2.start.getTime(),
            end:dates.day2.end.getTime(),
            meta:{
              name:'day 2'
            }
          }, next)
        },

        function(next){

          var bookings = {};
          var bookingarr = [];
          lendb.createBookingStream('mechanics.bob').pipe(through(function(booking){
            bookings[booking.id] = booking;
            bookingarr.push(booking);
          }, function(){

            bookings['10'].meta.name.should.equal('day 1 morning');
            bookingarr[0].id.should.equal(10);

            bookings['11'].meta.name.should.equal('day 1 afternoon');
            bookingarr[1].id.should.equal(11);

            bookings['12'].meta.name.should.equal('day 2');
            bookingarr[2].id.should.equal(12);

            bookingarr.length.should.equal(3);

            next();
          }))
          
        },

        function(next){

          var bookings = {};
          var bookingarr = [];

          lendb.createBookingStream('mechanics.bob', {
            start:new Date('03/01/2014 08:00:00'),
            end:new Date('03/06/2014 08:00:00')
          }).pipe(through(function(booking){
            bookings[booking.id] = booking;
            bookingarr.push(booking);
          }, function(){

            bookings['10'].meta.name.should.equal('day 1 morning');
            bookingarr[0].id.should.equal(10);

            bookings['11'].meta.name.should.equal('day 1 afternoon');
            bookingarr[1].id.should.equal(11);

            bookingarr.length.should.equal(2);


            next();
          }))
        },


        function(next){

          var bookings = {};
          var bookingarr = [];



          lendb.createBookingStream('mechanics.bob', {
            start:new Date('03/01/2014 08:00:00'),
            end:new Date('03/14/2014 08:00:00')
          }).pipe(through(function(booking){
            bookings[booking.id] = booking;
            bookingarr.push(booking);

          }, function(){

            bookings['10'].meta.name.should.equal('day 1 morning');
            bookingarr[0].id.should.equal(10);

            bookings['11'].meta.name.should.equal('day 1 afternoon');
            bookingarr[1].id.should.equal(11);

            bookings['12'].meta.name.should.equal('day 2');
            bookingarr[2].id.should.equal(12);

            bookingarr.length.should.equal(3);

            next();
          }))

          


        },

        function(next){


          var bookings = {};
          var bookingarr = [];


          lendb.createBookingStream('mechanics.bob', {
            start:new Date('03/01/2014 08:00:00'),
            end:new Date('03/12/2014 10:00:00'),
            inclusive:true
          }).pipe(through(function(booking){
            bookings[booking.id] = booking;
            bookingarr.push(booking);
          }, function(){


            bookings['10'].meta.name.should.equal('day 1 morning');
            bookingarr[0].id.should.equal(10);

            bookings['11'].meta.name.should.equal('day 1 afternoon');
            bookingarr[1].id.should.equal(11);

            bookingarr.length.should.equal(2);


            next();
          }))
        }
      ], done)

    })


    it('should fetch bookings below a path', function(done){
      var lendb = len(leveldb);

      var dates = {
        bob:{
          day1_morning:{
            start:new Date('03/01/2014 09:00:00'),
            end:new Date('03/01/2014 13:00:00')
          },
          day1_afternoon:{
            start:new Date('03/01/2014 13:30:00'),
            end:new Date('03/01/2014 18:00:00')
          },
          day2:{
            start:new Date('03/12/2014 09:30:00'),
            end:new Date('03/12/2014 18:00:00')
          }
        },
        dave:{
          day1_morning:{
            start:new Date('03/03/2014 09:00:00'),
            end:new Date('03/03/2014 13:00:00')
          },
          day1_afternoon:{
            start:new Date('03/03/2014 13:30:00'),
            end:new Date('03/03/2014 18:00:00')
          },
          day2:{
            start:new Date('03/16/2014 09:30:00'),
            end:new Date('03/16/2014 18:00:00')
          }
        }
      }

      async.series([
        function(next){

          lendb.saveBooking('mechanics.bob', {
            id:10,
            start:dates.bob.day1_morning.start.getTime(),
            end:dates.bob.day1_morning.end.getTime(),
            meta:{
              name:'day 1 morning'
            }
          }, function(){
            lendb.saveBooking('mechanics.dave', {
              id:10,
              start:dates.dave.day1_morning.start.getTime(),
              end:dates.dave.day1_morning.end.getTime(),
              meta:{
                name:'day 1 morning'
              }
            }, next)
          })
          
        },

        function(next){

          lendb.saveBooking('mechanics.bob', {
            id:11,
            start:dates.bob.day1_afternoon.start.getTime(),
            end:dates.bob.day1_afternoon.end.getTime(),
            meta:{
              name:'day 1 afternoon'
            }
          }, function(){
            lendb.saveBooking('mechanics.dave', {
              id:11,
              start:dates.dave.day1_afternoon.start.getTime(),
              end:dates.dave.day1_afternoon.end.getTime(),
              meta:{
                name:'day 1 afternoon'
              }
            }, next);
          })
        },

        function(next){

          lendb.saveBooking('mechanics.bob', {
            id:12,
            start:dates.bob.day2.start.getTime(),
            end:dates.bob.day2.end.getTime(),
            meta:{
              name:'day 2'
            }
          }, function(){
            lendb.saveBooking('mechanics.dave', {
              id:12,
              start:dates.dave.day2.start.getTime(),
              end:dates.dave.day2.end.getTime(),
              meta:{
                name:'day 2'
              }
            }, next)
          })
        },

        function(next){

          var bookings = {};
          var bookingarr = [];
          lendb.createBookingStream('mechanics').pipe(through(function(booking){
            bookings[booking.id] = booking;
            bookingarr.push(booking);
          }, function(){


            bookingarr.length.should.equal(6);

            next();
          }))
          
        },

      ], done)

    })
  })


  describe('range query', function(){

    it('should match only bookings in a time period for one resource', function(done){
      var lendb = len(leveldb);

      var dates = {
        day1_morning:{
          start:new Date('03/01/2014 09:00:00'),
          end:new Date('03/01/2014 13:00:00')
        },
        day1_afternoon:{
          start:new Date('03/01/2014 13:30:00'),
          end:new Date('03/01/2014 18:00:00')
        },
        day2:{
          start:new Date('03/12/2014 09:30:00'),
          end:new Date('03/12/2014 18:00:00')
        }
      }


      async.series([
        function(next){

          lendb.saveBooking('mechanics.bob', {
            id:10,
            start:dates.day1_morning.start.getTime(),
            end:dates.day1_morning.end.getTime(),
            meta:{
              name:'day 1 morning'
            }
          }, next)
          
        },

        function(next){

          lendb.saveBooking('mechanics.bob', {
            id:11,
            start:dates.day1_afternoon.start.getTime(),
            end:dates.day1_afternoon.end.getTime(),
            meta:{
              name:'day 1 afternoon'
            }
          }, next)
        },

        function(next){

          lendb.saveBooking('mechanics.bob', {
            id:12,
            start:dates.day2.start.getTime(),
            end:dates.day2.end.getTime(),
            meta:{
              name:'day 2'
            }
          }, next)
        },

        function(next){
          lendb.getRange('mechanics.bob', function(err, range){
            range.start.should.equal(dates.day1_morning.start.getTime())
            range.end.should.equal(dates.day2.end.getTime())
            next();
          })
        },

        function(next){
          lendb.getRange('mechanics.bob', {
            start:new Date('03/01/2014 08:00:00'),
            end:new Date('03/06/2014 08:00:00')
          }, function(err, range){
            range.start.should.equal(dates.day1_morning.start.getTime())
            range.end.should.equal(dates.day1_afternoon.end.getTime())
            next();
          })
        },


        function(next){
          lendb.getRange('mechanics.bob', {
            start:new Date('03/01/2014 08:00:00'),
            end:new Date('03/12/2014 10:00:00')
          }, function(err, range){
            range.start.should.equal(dates.day1_morning.start.getTime())
            range.end.should.equal(dates.day2.end.getTime())
            next();
          })
        },

        function(next){
          lendb.getRange('mechanics.bob', {
            start:new Date('03/01/2014 08:00:00'),
            end:new Date('03/12/2014 10:00:00'),
            inclusive:true
          }, function(err, range){
            range.start.should.equal(dates.day1_morning.start.getTime())
            range.end.should.equal(dates.day1_afternoon.end.getTime())
            next();
          })
        }
      ], done)

    })


    it('should match bookings for resources below a path', function(done){
      var lendb = len(leveldb);

      var dates = {
        bob:{
          day1_morning:{
            start:new Date('03/01/2014 09:00:00'),
            end:new Date('03/01/2014 13:00:00')
          },
          day1_afternoon:{
            start:new Date('03/01/2014 13:30:00'),
            end:new Date('03/01/2014 18:00:00')
          },
          day2:{
            start:new Date('03/12/2014 09:30:00'),
            end:new Date('03/12/2014 18:00:00')
          }
        },
        dave:{
          day1_morning:{
            start:new Date('03/03/2014 09:00:00'),
            end:new Date('03/03/2014 13:00:00')
          },
          day1_afternoon:{
            start:new Date('03/03/2014 13:30:00'),
            end:new Date('03/03/2014 18:00:00')
          },
          day2:{
            start:new Date('03/16/2014 09:30:00'),
            end:new Date('03/16/2014 18:00:00')
          }
        }
      }

      async.series([
        function(next){

          lendb.saveBooking('mechanics.bob', {
            id:10,
            start:dates.bob.day1_morning.start.getTime(),
            end:dates.bob.day1_morning.end.getTime(),
            meta:{
              name:'day 1 morning'
            }
          }, function(){
            lendb.saveBooking('mechanics.dave', {
              id:10,
              start:dates.dave.day1_morning.start.getTime(),
              end:dates.dave.day1_morning.end.getTime(),
              meta:{
                name:'day 1 morning'
              }
            }, next)
          })
          
        },

        function(next){

          lendb.saveBooking('mechanics.bob', {
            id:11,
            start:dates.bob.day1_afternoon.start.getTime(),
            end:dates.bob.day1_afternoon.end.getTime(),
            meta:{
              name:'day 1 afternoon'
            }
          }, function(){
            lendb.saveBooking('mechanics.dave', {
              id:11,
              start:dates.dave.day1_afternoon.start.getTime(),
              end:dates.dave.day1_afternoon.end.getTime(),
              meta:{
                name:'day 1 afternoon'
              }
            }, next);
          })
        },

        function(next){

          lendb.saveBooking('mechanics.bob', {
            id:12,
            start:dates.bob.day2.start.getTime(),
            end:dates.bob.day2.end.getTime(),
            meta:{
              name:'day 2'
            }
          }, function(){
            lendb.saveBooking('mechanics.dave', {
              id:12,
              start:dates.dave.day2.start.getTime(),
              end:dates.dave.day2.end.getTime(),
              meta:{
                name:'day 2'
              }
            }, next)
          })
        },

        function(next){
          lendb.getRange('mechanics', function(err, range){
            range.start.should.equal(dates.bob.day1_morning.start.getTime())
            range.end.should.equal(dates.dave.day2.end.getTime())
            next();
          })
        },

        function(next){
          lendb.getRange('mechanics', {
            start:new Date('03/01/2014 08:00:00'),
            end:new Date('03/06/2014 08:00:00')
          }, function(err, range){
            range.start.should.equal(dates.bob.day1_morning.start.getTime())
            range.end.should.equal(dates.dave.day1_afternoon.end.getTime())
            next();
          })
        },

        function(next){
          lendb.getRange('mechanics', {
            start:new Date('03/01/2014 08:00:00'),
            end:new Date('03/14/2014 10:00:00')
          }, function(err, range){

            range.start.should.equal(dates.bob.day1_morning.start.getTime())
            range.end.should.equal(dates.bob.day2.end.getTime())
            next();
          })
        },

        function(next){
          lendb.getRange('mechanics', {
            start:new Date('03/01/2014 08:00:00'),
            end:new Date('03/12/2014 10:00:00'),
            inclusive:true
          }, function(err, range){
            range.start.should.equal(dates.bob.day1_morning.start.getTime())
            range.end.should.equal(dates.dave.day1_afternoon.end.getTime())
            next();
          })
        }
      ], done)

    })

  })




	
})


