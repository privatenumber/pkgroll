if (process.env.NODE_ENV === 'production') {
	console.log('production');
	require('./target');
} else {
	console.log('development');
}

console.log(1);