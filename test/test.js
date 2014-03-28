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
          instruction.value.should.equal('project.a.b.10');  
        }
        
      })
      batch[0].key.should.equal('schedule~project~a~b~20~10');
      batch[1].key.should.equal('schedule~project~a~b~30~10');
      batch[2].key.should.equal('schedule~project~a~20~10');
      batch[3].key.should.equal('schedule~project~a~30~10');
      batch[4].key.should.equal('schedule~project~20~10');
      batch[5].key.should.equal('schedule~project~30~10');
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

  })

  describe('events', function(){
    

    it('should emit events as data is written', function(done){


      done();
      
    })

  })

	
})


