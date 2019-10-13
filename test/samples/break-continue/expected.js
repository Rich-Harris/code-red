x: for (let i = 0; i < 10; i += 1) {
	if (should_break) {
		break;
	}

	if (should_break_with_label) {
		break x;
	}

	if (should_continue) {
		continue;
	}

	if (should_continue_with_label) {
		continue x;
	}
}