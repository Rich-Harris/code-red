try {
	foo();
} catch {
	bar();
}

try {
	foo();
} catch(e) {
	bar(e);
} finally {
	baz();
}