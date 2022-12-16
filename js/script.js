NodeList.prototype[Symbol.iterator] = Array.prototype[Symbol.iterator];
HTMLCollection.prototype[Symbol.iterator] = Array.prototype[Symbol.iterator];
var dayCnt = 0
const init = () => {
	toggleChartData(dayCnt)
	const sliderProps = {
		fill: "#0B1EDF",
		background: "rgba(255, 255, 255, 0.214)",
	};

	const applyFill = (slider,sliderValue) => {
		const percentage = (100 * (slider.value - slider.min)) / (slider.max - slider.min);
		const bg = `linear-gradient(90deg, ${sliderProps.fill} ${percentage}%, ${sliderProps.background} ${percentage +
				0.1}%)`;
		slider.style.background = bg;
		sliderValue.setAttribute("data-length", slider.value)
	}

	// Selecting the Range Slider container
	const sliders = document.getElementsByClassName("range__slider")
	for (let i = 0; i < sliders.length; i++){
		let sld = sliders[i]
		// // Text which will show the value of the range slider.
		const sliderValue = sld.querySelector(".length__title")
		// Using Event Listener to apply the fill and also change the value of the text.
		sld.querySelector("input").addEventListener("input", event => {
			sliderValue.setAttribute("data-length", event.target.value);
			applyFill(event.target,sliderValue);
		});
		applyFill(sld.querySelector("input"),sliderValue)
	}


	let cb = document.getElementsByClassName("btn_container")
	// simulate click
	cb[0].getElementsByTagName("button").Simulate.addEventListener("click", () => {
		toggleChartData(dayCnt)
	})
	
	cb[1].getElementsByTagName("button")[0].addEventListener("click", () => {
		dayCnt++
	 	toggleChartData(dayCnt)
	})
	cb[1].getElementsByTagName("button")[1].addEventListener("click", () => {
		Math.max(dayCnt--,0)
		toggleChartData(dayCnt)
	})
}
window.addEventListener('load', ()=> {
	init()
})


