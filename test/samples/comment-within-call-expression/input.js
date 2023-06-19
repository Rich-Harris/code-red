export default ({ b }) => b`
	console.log(null, /* xxx */ new Date(), /** zzz */ a.b.c()); // www
	console.log(null,
		// foo
		new Date()
	);
	console.log(null, // foo
		new Date()
	);
	console.log(null, /* xxx */ function (a, b) {
		// yyy
		return a + b;
	})
	console.log("1");
`;