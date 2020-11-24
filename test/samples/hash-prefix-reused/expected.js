function foo(bar$1) {
	const bar = 'x';
	bar$1 += 1;

	return bar => {
		console.log(bar);
	};
}