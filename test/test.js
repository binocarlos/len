var len = require('../src/index');
var level = require('level');
var concat = require('concat-stream');
var through = require('through');
var http = require('http');
var async = require('async');
var wrench = require('wrench');

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

  describe('constructor', function(){
  
    it('should be a function', function(){
      len.should.be.type('function');
    })

    it('should expose the tools', function(){
      len.tools.parsedots.should.be.type('function');
      len.tools.getdots.should.be.type('function');
      len.tools.querykeys.should.be.type('function');
      len.tools.schedulekey.should.be.type('function');
      len.tools.bookingkey.should.be.type('function');
      len.tools.levelrange.should.be.type('function');
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

  describe('schedule', function(){

    function test_batch(batch, type){

      batch.length.should.equal(6);

      batch.forEach(function(instruction){
        instruction.type.should.equal(type);

        if(instruction.value){

          var hit = instruction.value.match(/^project\.a\.b\.10:/);

          (hit ? true : false).should.equal(true);
        }
        
      })
      batch[0].key.should.equal('schedule~project~a~b~_booking~20~10');
      batch[1].key.should.equal('schedule~project~a~b~_booking~30~10');
      batch[2].key.should.equal('schedule~project~a~_booking~20~10');
      batch[3].key.should.equal('schedule~project~a~_booking~30~10');
      batch[4].key.should.equal('schedule~project~_booking~20~10');
      batch[5].key.should.equal('schedule~project~_booking~30~10');
    }

    it('should make an add batch', function(done){

      var lendb = len(leveldb);

      var batch = lendb._schedule.addBatch('project.a.b', 10, 20, 30);

      test_batch(batch, 'put');
      
      done();

    })


    it('should make an remove batch', function(done){

      var lendb = len(leveldb);

      var batch = lendb._schedule.removeBatch('project.a.b', 10, 20, 30);

      test_batch(batch, 'del');
      done();

    })

  })

  describe('bookings', function(){

    it('should save and load a booking', function(done){
      var lendb = len(leveldb);

      var start = new Date('01/03/2014 09:00:00');
      var end = new Date('01/03/2014 13:00:00');

      async.series([
        function(next){

          lendb.saveBooking('mechanics.bob', 10, start.getTime(), end.getTime(), {
            name:'Fix car'
          }, function(err){
            next(err);
          })
          
        },

        function(next){

          lendb.loadBooking('mechanics.bob', 10, function(err, booking){

            booking.resource.should.equal('mechanics.bob');
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

          lendb.saveBooking('mechanics.bob', 10, start.getTime(), end.getTime(), {
            name:'Fix car'
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

          lendb.saveBooking('mechanics.bob', 10, start.getTime(), end.getTime(), {
            name:'Fix car'
          }, function(err){
            next(err);
          })
          
        },

        function(next){

          
          lendb.saveBooking('mechanics.bob', 10, start.getTime()+10, end.getTime(), {
            name:'Fix car2'
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

          lendb.saveBooking('mechanics.bob', 10, dates.day1_morning.start.getTime(), dates.day1_morning.end.getTime(), {
            name:'day 1 morning'
          }, next)
          
        },

        function(next){

          lendb.saveBooking('mechanics.bob', 11, dates.day1_afternoon.start.getTime(), dates.day1_afternoon.end.getTime(), {
            name:'day 1 afternoon'
          }, next)
        },

        function(next){

          lendb.saveBooking('mechanics.bob', 12, dates.day2.start.getTime(), dates.day2.end.getTime(), {
            name:'day 2'
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
          lendb.createBookingStream('mechanics.bob', {
            start:new Date('03/01/2014 08:00:00'),
            end:new Date('03/12/2014 10:00:00'),
            inclusive:true
          }).pipe(through(function(booking){
            bookings[booking.id] = booking;

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

          lendb.saveBooking('mechanics.bob', 10, dates.bob.day1_morning.start.getTime(), dates.day1_morning.end.getTime(), {
            name:'day 1 morning'
          }, function(){
            lendb.saveBooking('mechanics.dave', 10, dates.dave.day1_morning.start.getTime(), dates.day1_morning.end.getTime(), {
              name:'day 1 morning'
            }, next)
          })
          
        },

        function(next){

          lendb.saveBooking('mechanics.bob', 11, dates.bob.day1_afternoon.start.getTime(), dates.day1_afternoon.end.getTime(), {
            name:'day 1 afternoon'
          }, function(){
            lendb.saveBooking('mechanics.dave', 11, dates.dave.day1_afternoon.start.getTime(), dates.day1_afternoon.end.getTime(), {
              name:'day 1 afternoon'
            }, next);
          })
        },

        function(next){

          lendb.saveBooking('mechanics.bob', 12, dates.bob.day2.start.getTime(), dates.day2.end.getTime(), {
            name:'day 2'
          }, function(){
            lendb.saveBooking('mechanics.dave', 12, dates.dave.day2.start.getTime(), dates.day2.end.getTime(), {
              name:'day 2'
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

          lendb.saveBooking('mechanics.bob', 10, dates.day1_morning.start.getTime(), dates.day1_morning.end.getTime(), {
            name:'day 1 morning'
          }, next)
          
        },

        function(next){

          lendb.saveBooking('mechanics.bob', 11, dates.day1_afternoon.start.getTime(), dates.day1_afternoon.end.getTime(), {
            name:'day 1 afternoon'
          }, next)
        },

        function(next){

          lendb.saveBooking('mechanics.bob', 12, dates.day2.start.getTime(), dates.day2.end.getTime(), {
            name:'day 2'
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
            start:new Date('03/01/2014 08:00:00').getTime(),
            end:new Date('03/06/2014 08:00:00').getTime()
          }, function(err, range){
            range.start.should.equal(dates.day1_morning.start.getTime())
            range.end.should.equal(dates.day1_afternoon.end.getTime())
            next();
          })
        },


        function(next){
          lendb.getRange('mechanics.bob', {
            start:new Date('03/01/2014 08:00:00').getTime(),
            end:new Date('03/12/2014 10:00:00').getTime()
          }, function(err, range){
            range.start.should.equal(dates.day1_morning.start.getTime())
            range.end.should.equal(dates.day2.end.getTime())
            next();
          })
        },

        function(next){
          lendb.getRange('mechanics.bob', {
            start:new Date('03/01/2014 08:00:00').getTime(),
            end:new Date('03/12/2014 10:00:00').getTime(),
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

          lendb.saveBooking('mechanics.bob', 10, dates.bob.day1_morning.start.getTime(), dates.day1_morning.end.getTime(), {
            name:'day 1 morning'
          }, function(){
            lendb.saveBooking('mechanics.dave', 10, dates.dave.day1_morning.start.getTime(), dates.day1_morning.end.getTime(), {
              name:'day 1 morning'
            }, next)
          })
          
        },

        function(next){

          lendb.saveBooking('mechanics.bob', 11, dates.bob.day1_afternoon.start.getTime(), dates.day1_afternoon.end.getTime(), {
            name:'day 1 afternoon'
          }, function(){
            lendb.saveBooking('mechanics.dave', 11, dates.dave.day1_afternoon.start.getTime(), dates.day1_afternoon.end.getTime(), {
              name:'day 1 afternoon'
            }, next);
          })
        },

        function(next){

          lendb.saveBooking('mechanics.bob', 12, dates.bob.day2.start.getTime(), dates.day2.end.getTime(), {
            name:'day 2'
          }, function(){
            lendb.saveBooking('mechanics.dave', 12, dates.dave.day2.start.getTime(), dates.day2.end.getTime(), {
              name:'day 2'
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
            start:new Date('03/01/2014 08:00:00').getTime(),
            end:new Date('03/06/2014 08:00:00').getTime()
          }, function(err, range){
            range.start.should.equal(dates.bob.day1_morning.start.getTime())
            range.end.should.equal(dates.dave.day1_afternoon.end.getTime())
            next();
          })
        },

        function(next){
          lendb.getRange('mechanics', {
            start:new Date('03/01/2014 08:00:00').getTime(),
            end:new Date('03/14/2014 10:00:00').getTime()
          }, function(err, range){
            range.start.should.equal(dates.bob.day1_morning.start.getTime())
            range.end.should.equal(dates.dave.day2.end.getTime())
            next();
          })
        },

        function(next){
          lendb.getRange('mechanics', {
            start:new Date('03/01/2014 08:00:00').getTime(),
            end:new Date('03/12/2014 10:00:00').getTime(),
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


