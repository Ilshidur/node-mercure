// From : https://github.com/chriso/validator.js/blob/master/src/lib/isJWT.js
const isJwt = jwt => jwt && /^([A-Za-z0-9\-_~+\/]+[=]{0,2})\.([A-Za-z0-9\-_~+\/]+[=]{0,2})(?:\.([A-Za-z0-9\-_~+\/]+[=]{0,2}))?$/.test(jwt);

module.exports = { isJwt };
