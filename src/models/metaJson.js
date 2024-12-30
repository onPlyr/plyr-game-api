const mongoose = require('mongoose');

const metaJsonSchema = new mongoose.Schema({
    uri: { type: String, required: true, unique: true },
    data: { type: Object, required: true },
});

module.exports = mongoose.model('metaJson', metaJsonSchema);
