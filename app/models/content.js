
/*!
 * Module dependencies
 */

var 
	_ = require('underscore'),
	async = require('async'),
	mongoose = require('mongoose'),
	Schema = mongoose.Schema;

/**
 * Layer schema
 */

var ContentSchema = new Schema({
	type: { type: String, enum: ['Markdown', 'Post', 'Video', 'Image Gallery'], required: true},
	title: { type: String, required: true },
	url: String,
	sirTrevorData: [],
	sirTrevor: String,
	markdown: String,	
	creator: {type: Schema.ObjectId, ref: 'User'},
	features: [{type: Schema.ObjectId, ref: 'Feature'}],
	layer: {type: Schema.ObjectId, ref: 'Layer', required: true},
	createdAt: {type: Date, default: Date.now},
	updateAt: {type: Date, default: Date.now},
	tags: [String]
});

/**
 * Hooks
 */

ContentSchema.pre('remove', function(next){
	var self = this;

	async.parallel([
		// remove related images
		function(callback){
			async.each(self.sirTrevorData, function(item, done){
				if (item.type == 'image') {
					mongoose.model('Image').findById(item.data._id, function(err,img){
						if (err) done(err);
						else {
							// delete reference to this content to avoid circular execution
							img.content = null;
							img.save(function(err){
								if (err) done(err);
								else img.remove(function(err){
									done();
								});
							});
						}
					});
				}
			}, callback);
			// callback();
		},
		function(callback){
			
			// remove association from features
			async.each(self.features, function(featureId, done){
				mongoose.model('Feature').findById(featureId, function(err, feature){
					if (err) next(err)
					else {
						feature.contents.pull(self._id);
						feature.save(function(err){
							done(err);
						});
					}
				})
			}, callback);
		}
	], next);
	// ], function(){});

});

/**
 * Methods
 */

ContentSchema.methods = {

	removeFeatureAndSave: function(feature, done){
		var 
			self = this;

		if (typeof(feature['_id']) != 'undefined') { feature = feature._id; }

		self.features = _.without(self.features, _.findWhere(self.features, feature));

		self.save(done);
	},
	
	setFeaturesAndSave: function(featureSet, done) {
		var 
			currentFeatures = this.features,
			self = this;

		if (!featureSet) done();
		else {
			async.each(this.features, function(ftId, cb){
				mongoose.model('Feature').findById(ftId, function(err,ft){
					ft.contents.pull(self._id);
					ft.save(cb);
				})
			}, 
			function(err){
				if (err) done(err);
				async.each(featureSet, function(newFtId, cb){
					mongoose.model('Feature').findById(newFtId, function(err, newFt){
						newFt.contents.addToSet(self._id);
						newFt.save(cb);
					})
				}, function(err){
					if (err) done(err);
					self.features = featureSet;
					self.save(done);
				});
			});
		}
	},
	
	setFeatures: function(featureSet, done) {
		var 
			self = this,
			featuresToRemove,
			featuresToAdd;
			
		function getRemovedFeatures(newFeatureSet){
			var removedFeatures = [];
			_.each(self.features, function(item){
				if (!_.contains(newFeatureSet, item)) {
					removedFeatures.push(item);
				}
			})
			return removedFeatures;
		}
		
		function getAddedFeatures(newFeatureSet){
			var addedFeatures = [];
			_.each(newFeatureSet, function(item){
				if (!_.contains(self.features, item)) {
					addedFeatures.push(item);
				}
			})
			return addedFeatures;
		}
	
		featuresToRemove = getRemovedFeatures(featureSet);
		featuresToAdd = getAddedFeatures(featureSet);
	
		async.parallel([
			
			// remove features
			function(callback){
				
				// callback if nothing to remove
				if (!featuresToRemove) 
					callback();
				else
					async.each(featuresToRemove, function(item, cb){
						
						// find feature and remove reference to this content
						mongoose.model('Feature').findById(item, function(err,ft){
							ft.contents.pull(self._id);
							ft.save(cb);
						});
						
					}, callback);
			},
			function(callback){
				
				// callback if nothing to add
				if (!featuresToAdd) 
					callback();
				else
					async.each(featuresToAdd, function(item, cb){
						// add reference to this content
						mongoose.model('Feature').findById(item, function(err, newFt){
							newFt.contents.addToSet(self._id);
							newFt.save(cb);
						});
					}, callback);
			}
		], function(err){
			self.features = featureSet;
			done(err, self);
		});
	},

	updateSirTrevor: function(sirTrevorData, done){
		var 
			self = this,
			imagesToRemove,
			imagesToAdd;
		
		function getRemovedImages(sirTrevorData){
			var removedImages = [];
			_.each(self.sirTrevorData, function(item){
				if ((item.type == 'image') && !_.contains(sirTrevorData, item)) {
					removedImages.push(item);
				}
			})
			return removedImages;
		}

		function getAddedImages(sirTrevorData){
			var addedImages = [];
			_.each(sirTrevorData, function(item){
				if ((item.type == 'image') && !_.contains(self.sirTrevorData, item)) {
					addedImages.push(item);
				}
			})
			return addedImages;
		}
		
		imagesToRemove = getRemovedImages(sirTrevorData);
		imagesToAdd = getAddedImages(sirTrevorData);
		
		async.parallel([
			function(callback){
				if (!imagesToRemove) 
					callback();
				else
					async.each(imagesToRemove, function(item, cb){
						mongoose.model('Image').findById(item.data._id).remove(cb)
					}, callback);
			},
			function(callback){
				if (!imagesToAdd) 
					callback();
				else
					async.each(imagesToAdd, function(item, cb){
						mongoose.model('Image').findById(item.data._id, function(err, img){
							if (err) {
								cb(err);
							}
							else {
								// set reference to this content
								img.content = self;
								img.save(cb);
							}
						});
				}, callback)
			}
		], function(){
			self.sirTrevorData = sirTrevorData;
			done(self);
		});
	},

	removeImageAndSave: function(imageId, done) {

		var self = this;

		async.each(self.sirTrevorData, function(item, done){
			// if image exists in sirTrevor, remove it
			if ((item.type == 'image') && (item.data._id.toHexString() == imageId.toHexString())) {
				self.sirTrevorData.pull(item);
			}
			done();			
		}, function(err){
			if (err) done(err);
			else self.save(done);
		});
	}
}

/**
 * Statics
 */

ContentSchema.statics = {

	load: function (id, cb) {
		this.findOne({ _id : id })
			.populate('layer')
			.populate('features')
			.exec(cb)
	},
	
	list: function (options, cb) {
		var criteria = options.criteria || {}

		this.find(criteria)
			.sort({'createdAt': -1}) // sort by date
			.limit(options.perPage)
			.skip(options.perPage * options.page)
		.exec(cb)
	}	
	
}

mongoose.model('Content', ContentSchema)