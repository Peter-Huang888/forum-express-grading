const { Restaurant, Category, Comment, User } = require('../../models')
const restaurantServices = require('../../services/restaurant-services') // 引入 restaurant-services
const { getUser } = require('../../helpers/auth-helpers')

const restaurantController = {
  getRestaurants: (req, res, next) => {
    restaurantServices.getRestaurants(req, (err, data) => err ? next(err) : res.render('restaurants', data))
  },
  getRestaurant: (req, res, next) => {
    const id = req.params.id
    return Restaurant.findByPk(id, {
      include: [ // Nested eager loading
        Category,
        { model: Comment, include: User },
        { model: User, as: 'FavoritedUsers' },
        { model: User, as: 'LikedUsers' }
      ]
    })
      .then(restaurant => {
        if (!restaurant) { throw new Error("Restaurant didn't exist!") }
        return restaurant.increment('viewCounts')
      })
      .then(updateRestaurant => {
        const { isFavorited, isLiked } = {
          isFavorited: updateRestaurant.FavoritedUsers.some(f => f.id === req.user.id),
          isLiked: updateRestaurant.LikedUsers.some(f => f.id === req.user.id)
        }
        res.render('restaurant', {
          restaurant: updateRestaurant.toJSON(),
          isFavorited,
          isLiked
        })
      })
      .catch(err => next(err))
  },
  getDashboard: (req, res, next) => {
    const id = req.params.id
    return Restaurant.findByPk(id, {
      include: [Category,
        Comment,
        { model: User, as: 'FavoritedUsers' }
      ],
      nest: true
    })
      .then(restaurant => {
        if (!restaurant) { throw new Error("Restaurant didn't exist") }
        const result = restaurant.toJSON()
        res.render('dashboard', { restaurant: result })
      })
      .catch(err => next(err))
  },
  getFeeds: (req, res, next) => {
    return Promise.all([
      Restaurant.findAll({
        limit: 10,
        order: [['createdAt', 'DESC']],
        include: [Category],
        raw: true,
        nest: true
      }),
      Comment.findAll({
        limit: 10,
        order: [['createdAt', 'DESC']],
        include: [User, Restaurant],
        raw: true,
        nest: true
      })
    ])
      .then(([restaurants, comments]) => {
        return res.render('feeds', {
          restaurants,
          comments
        })
      })
      .catch(err => next(err))
  },
  getTopRestaurants: (req, res, next) => {
    return Restaurant.findAll({
      include: [Category, { model: User, as: 'FavoritedUsers' }]
    })
      .then(restaurants => {
        const result = restaurants.map(restaurant => ({
          ...restaurant.toJSON(),
          description: restaurant.description.substring(0, 50),
          favoritedCount: restaurant.FavoritedUsers.length,
          isFavorited: restaurant.FavoritedUsers.some(f => f.id === getUser(req).id)
        }))
          .sort((a, b) => b.favoritedCount - a.favoritedCount)
          .slice(0, 10)
        return res.render('top-restaurants', { restaurants: result })
      })
      .catch(err => next(err))
  }
}
module.exports = restaurantController
