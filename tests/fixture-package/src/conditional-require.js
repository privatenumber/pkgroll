if (process.env.NODE_ENV === 'production') {
	console.log('production');
	require('./cjs.cjs');
} else {
	console.log('development');
}

console.log(1);