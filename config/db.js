const mongoose = require('mongoose')
const dotenv = require('dotenv')
dotenv.config()
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            dbName: 'ganpatiutustav2026'
        })
        console.log('✅ MongoDB connected')
        console.log('✅ Database: ganpatiutustav2026')
    } catch (err) {
        console.error('❌ MongoDB connection error:', err)
        process.exit(1)
    }
}
module.exports = connectDB