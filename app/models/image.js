
/*!
 * Module dependencies
 */

var mongoose = require('mongoose'),
	Schema = mongoose.Schema,
	Imager = require('imager'),
	imagerConfig = require('../../config/imager.js'),
	imager = new Imager(imagerConfig, 'Local');

/**
 * Layer schema
 */

var ImageSchema = new Schema({
	creator: {type: Schema.ObjectId, ref: 'User'},
	content: {type: Schema.ObjectId, ref: 'content'},
	uploadedAt: {type: Date, default: Date.now},
	file: {
		name: String,
		url: String
	}
});

/**
 * Hooks
 */

ImageSchema.pre('remove', function(next){
	var self = this;

	imager.remove([self.file.name], function(err){
		if (self.content) 
			self.content.removeImageAndSave(self._id, next);
		else
			next(err);
	}, 'items');
});

/**
 * Methods
 */

ImageSchema.methods = {

	uploadImageAndSave: function(sourcefile, baseUrl, done){
		var 
			self = this;

		imager.upload([sourcefile], function (err, cdnUri, uploaded) {
			if (err) next(err);
			else {
				self.file.name = uploaded[uploaded.length-1];
				self.file.url = baseUrl + self.file.name;
				self.save(done);
			}
		}, 'items');
	}
}



mongoose.model('Image', ImageSchema);