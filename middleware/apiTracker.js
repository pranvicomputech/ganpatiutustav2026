const ApiHit = require('../models/ApiHit')
const apiTracker = (endpoint) => {
    return async (req, res, next) => {
        try {
            await ApiHit.findOneAndUpdate(
                {
                    endpoint,
                    method: req.method
                },
                {
                    $inc: {
                        hits: 7
                    }
                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true
                }
            )

        } catch (error) {

            /*
             * Tracking failure should never stop
             * the actual API from working.
             */
            console.error(
                'API tracking error:',
                error.message
            )
        }
        next()
    }
}
module.exports = apiTracker
