import jwt from 'jsonwebtoken';
import httpStatus from 'http-status';
import APIError from '../helpers/APIError';
import User from '../models/user.model';
import config from '../../config/config';

// sample user, used for authentication
const user = {
  username: 'react',
  password: 'express'
};

/**
 * Returns jwt token if valid username and password is provided
 * @param req
 * @param res
 * @param next
 * @returns {*}
 */
function login(req, res, next) {
  if (req.body.username && req.body.password) {
    User.findOne({
      username: req.body.username
    }, (err, userObj) => {
      if (err) throw err;

      if (!userObj) {
        const error = new APIError('User not found', httpStatus.NOT_FOUND, true);
        return next(error);
      }
      // check if password matches
      userObj.comparePassword(req.body.password, function (err2, isMatch) {
        if (isMatch && !err) {
          // if user is found and password is right create a token
          const token = jwt.sign({ usrname: userObj.username }, config.jwtSecret);
          // return the information including token as JSON
          res.status(200).json({ success: true, username: userObj.username, token });
          return next();
        }
      });
      const error = new APIError('Authentication error', httpStatus.UNAUTHORIZED, true);
      return next(error);
    });
  } else {
    const error = new APIError('Authentication error', httpStatus.UNAUTHORIZED, true);
    return next(error);
  }
}

/**
 * This is a protected route. Will return random number only if jwt token is provided in header.
 * @param req
 * @param res
 * @returns {*}
 */
function getRandomNumber(req, res) {
  // req.user is assigned by jwt middleware if valid token is provided
  return res.json({
    user: req.user,
    num: Math.random() * 100
  });
}

export default { login, getRandomNumber };
