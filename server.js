const express = require('express')
const cors = require('cors')
const multer = require('multer')
const path = require('path')
const dotenv = require('dotenv')
const connectDB = require('./config/db')
const Store = require('./models/Store')
const Rating = require('./models/Rating')
const User = require('./models/User')
const ApiHit = require('./models/ApiHit')
const apiTracker = require('./middleware/apiTracker')
dotenv.config()
connectDB()
const app = express()
app.use(cors())
app.use(express.json())
app.use((req, res, next) => {
  console.log(`[INCOMING] ${new Date().toISOString()} ${req.method} ${req.originalUrl}`)
  next()
})
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/')
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`)
  }
})
const upload = multer({ storage })
const slugify = text => {
  return text.toLowerCase().replace(/ /g, '-')
}
app.post('/register', apiTracker('/register'), async (req, res) => {
  try {
    const { name, mobile, city, address } = req.body
    if (!name || !mobile || !city) {
      return res.status(400).json({ error: 'Name, mobile and city are required' })
    }
    if (!/^[0-9]{10}$/.test(mobile)) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number' })
    }
    const existingUser = await User.findOne({ mobile })
    if (existingUser) {
      return res.status(409).json({ error: 'Mobile number is already registered' })
    }
    const user = await User.create({
      name: name.trim(),
      mobile: mobile.trim(),
      city: city.trim(),
      address: address ? address.trim() : '',
      visitedStores: []
    })
    console.log(`[USER CREATED] ${user.mobile}`)
    res.status(201).json({
      message: 'Registration successful',
      user: {
        name: user.name,
        mobile: user.mobile,
        city: user.city,
        address: user.address,
        visitedStores: user.visitedStores
      }
    })
  } catch (error) {
    console.error('[REGISTER ERROR]', error)
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Mobile number is already registered' })
    }
    res.status(500).json({ error: 'Server error' })
  }
})
app.post('/login', apiTracker('/login'), async (req, res) => {
  try {
    const { mobile } = req.body
    if (!mobile) {
      return res.status(400).json({ error: 'Mobile number is required' })
    }
    const user = await User.findOne({ mobile: mobile.trim() })
    if (!user) {
      return res.status(404).json({ error: 'User not found. Please register first.' })
    }
    console.log(`[USER LOGIN] ${user.mobile}`)
    console.log(`[USER VISITED STORES] ${JSON.stringify(user.visitedStores || [])}`)
    res.json({
      message: 'Login successful',
      user: {
        name: user.name,
        mobile: user.mobile,
        city: user.city,
        address: user.address,
        visitedStores: user.visitedStores || []
      }
    })
  } catch (error) {
    console.error('[LOGIN ERROR]', error)
    res.status(500).json({ error: 'Server error' })
  }
})
app.get('/api/hits', async (req, res) => {
  try {
    const results = await ApiHit.find().sort({ hits: -1 })
    const totalHits = results.reduce((total, item) => total + item.hits, 0)
    res.json({ totalHits, apis: results })
  } catch (error) {
    console.error('[API HITS ERROR]', error)
    res.status(500).json({ error: 'Unable to fetch API hits' })
  }
})
app.post('/admin/add-store', upload.single('image'), apiTracker('/admin/add-store'), async (req, res) => {
  try {
    console.log('[ADD STORE REQUEST]', JSON.stringify(req.body))
    const { name, mapLink, instaId, serialIndex, token } = req.body
    if (token !== process.env.ADMIN_TOKEN) {
      console.log('[ADMIN] Unauthorized store creation attempt')
      return res.status(403).json({ error: 'Unauthorized' })
    }
    if (!name || !mapLink || !instaId || serialIndex === undefined || serialIndex === '' || !req.file) {
      return res.status(400).json({ error: 'Missing fields' })
    }
    const serialNumber = Number(serialIndex)
    if (!Number.isInteger(serialNumber)) {
      return res.status(400).json({ error: 'Serial Index must be a number' })
    }
    const slug = slugify(name)
    const image = req.file.filename
    const existing = await Store.findOne({ slug })
    if (existing) {
      return res.status(400).json({ error: 'Store already exists' })
    }
    const store = await Store.create({
      name: name.trim(),
      slug,
      mapLink: mapLink.trim(),
      image,
      instaId: instaId.trim(),
      serialIndex: serialNumber
    })
    console.log(`[STORE CREATED] ${store.name} (${store.slug})`)
    res.json({ message: 'Store added successfully', store })
  } catch (error) {
    console.error('[ADD STORE ERROR]', error)
    res.status(500).json({ error: 'Server error' })
  }
})
app.get('/stores', apiTracker('/stores'), async (req, res) => {
  try {
    const mobile = req.query.mobile
    let user = null
    if (mobile) {
      user = await User.findOne({ mobile: mobile.trim() }).select('visitedStores')
    }
    const visitedStores = user?.visitedStores || []
    console.log(`[STORES] User: ${mobile || 'guest'}`)
    console.log(`[STORES] Visited: ${JSON.stringify(visitedStores)}`)
    const stores = await Store.find().sort({ serialIndex: 1 })
    const results = await Promise.all(
      stores.map(async store => {
        const ratings = await Rating.find({ storeSlug: store.slug })
        const averageRating = ratings.length ? (ratings.reduce((total, item) => total + item.rating, 0) / ratings.length).toFixed(1) : null
        const alreadyVisited = visitedStores.includes(store.slug)
        return {
          name: store.name,
          slug: store.slug,
          image: store.image,
          mapLink: store.mapLink,
          instaId: store.instaId,
          serialIndex: store.serialIndex,
          averageRating,
          totalRatings: ratings.length,
          alreadyVisited
        }
      })
    )
    res.json(results)
  } catch (error) {
    console.error('[STORES ERROR]', error)
    res.status(500).json({ error: 'Unable to fetch stores' })
  }
})
app.get('/store/:slug', apiTracker('/store/:slug'), async (req, res) => {
  try {
    const { slug } = req.params
    const store = await Store.findOne({ slug })
    if (!store) {
      return res.status(404).json({ error: 'Not found' })
    }
    const ratings = await Rating.find({ storeSlug: slug })
    const averageRating = ratings.length ? (ratings.reduce((total, item) => total + item.rating, 0) / ratings.length).toFixed(1) : null
    res.json({ store, averageRating })
  } catch (error) {
    console.error('[STORE ERROR]', error)
    res.status(500).json({ error: 'Server error' })
  }
})
app.post('/store/:slug/rate', apiTracker('/store/:slug/rate'), async (req, res) => {
  try {
    const { userName, userMobile, rating } = req.body
    const { slug } = req.params
    console.log(`[RATING REQUEST] User: ${userMobile}, Store: ${slug}, Rating: ${rating}`)
    if (!userName || !userMobile || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Invalid input' })
    }
    const user = await User.findOne({ mobile: userMobile.trim() })
    if (!user) {
      console.log(`[RATING ERROR] User not found: ${userMobile}`)
      return res.status(404).json({ error: 'User not found' })
    }
    const store = await Store.findOne({ slug })
    if (!store) {
      return res.status(404).json({ error: 'Store not found' })
    }
    const alreadyVisited = (user.visitedStores || []).includes(slug)
    if (alreadyVisited) {
      console.log(`[ALREADY VISITED] User: ${userMobile}, Store: ${slug}`)
      return res.status(403).json({ error: 'Already visited' })
    }
    const existingRating = await Rating.findOne({
      storeSlug: slug,
      userMobile: userMobile.trim()
    })
    if (existingRating) {
      console.log(`[ALREADY RATED] User: ${userMobile}, Store: ${slug}`)
      await User.findOneAndUpdate(
        { mobile: userMobile.trim() },
        { $addToSet: { visitedStores: slug } }
      )
      console.log(`[VISITED REPAIRED] User: ${userMobile}, Store: ${slug}`)
      return res.status(403).json({ error: 'Already rated', visited: true })
    }
    const savedRating = await Rating.create({
      storeSlug: slug,
      userName: userName.trim(),
      userMobile: userMobile.trim(),
      rating: Number(rating)
    })
    console.log(`[RATING SAVED] User: ${userMobile}, Store: ${slug}, Rating: ${rating}`)
    const updatedUser = await User.findOneAndUpdate(
      { mobile: userMobile.trim() },
      { $addToSet: { visitedStores: slug } },
      { new: true }
    )
    console.log(`[VISITED SAVED] User: ${userMobile}, Store: ${slug}`)
    console.log(`[VISITED STORES NOW] ${JSON.stringify(updatedUser.visitedStores)}`)
    res.json({
      message: 'Rating submitted',
      rating: savedRating,
      visited: true,
      visitedStores: updatedUser.visitedStores
    })
  } catch (error) {
    console.error('[RATING ERROR]', error)
    if (error.code === 11000) {
      console.log(`[DUPLICATE RATING] User: ${req.body.userMobile}, Store: ${req.params.slug}`)
      await User.findOneAndUpdate(
        { mobile: req.body.userMobile },
        { $addToSet: { visitedStores: req.params.slug } }
      )
      return res.status(403).json({ error: 'Already rated', visited: true })
    }
    res.status(500).json({ error: 'Server error' })
  }
})
app.get('/store/:slug/ratings', apiTracker('/store/:slug/ratings'), async (req, res) => {
  try {
    const ratings = await Rating.find({ storeSlug: req.params.slug })
    res.json(ratings)
  } catch (error) {
    console.error('[GET RATINGS ERROR]', error)
    res.status(500).json({ error: 'Unable to fetch ratings' })
  }
})
const PORT = process.env.PORT || 3000
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`)
})
