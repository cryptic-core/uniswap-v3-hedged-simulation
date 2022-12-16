var chart_d = null
var scatter_points = []
var below_zero = []
var below_zero_line = []

const getTokenAmountsFromDepositAmounts = (P,Pl,Pu,priceUSDX,priceUSDY,targetAmounts)=>{
    
    deltaL = targetAmounts / ((Math.sqrt(P) - Math.sqrt(Pl)) * priceUSDY + 
            (1 / Math.sqrt(P) - 1 / Math.sqrt(Pu)) * priceUSDX)
  
    deltaY = deltaL * (Math.sqrt(P) - Math.sqrt(Pl))
    if (deltaY * priceUSDY < 0)
      deltaY = 0
    if (deltaY * priceUSDY > targetAmounts)
      deltaY = targetAmounts / priceUSDY
  
    deltaX = deltaL * (1 / Math.sqrt(P) - 1 / Math.sqrt(Pu))
    if (deltaX * priceUSDX < 0)
      deltaX = 0;
    if (deltaX * priceUSDX > targetAmounts)
      deltaX = targetAmounts / priceUSDX
    
    return {deltaX,deltaY}
}

const calcLiquidity = (
    cprice,
    upper,
    lower,
    amountX,
    amountY
)=>{
    let liquidity = 0
    if(cprice <= lower){
        liquidity = amountX * (Math.sqrt(upper) * Math.sqrt(lower)) / (Math.sqrt(upper) - Math.sqrt(lower))
    }else if(upper < cprice){
        let Lx = amountX * (Math.sqrt(upper) * Math.sqrt(cprice)) / (Math.sqrt(upper) - Math.sqrt(cprice))
        let Ly = amountY / (Math.sqrt(cprice) - Math.sqrt(lower))
        liquidity = Math.min(Lx,Ly)
    }else{
        liquidity = amountY / (Math.sqrt(upper) - Math.sqrt(lower))
    }
    return liquidity
}

const getILPriceChange = (
    price,
    newPrice,
    upper,
    lower,
    amountX,
    amountY
  )=>{
    let L = calcLiquidity(price,upper,lower,amountX,amountY)
    let deltaP = Math.sqrt(newPrice) - Math.sqrt(price)
    let oneOverDeltaP = 1/(Math.sqrt(newPrice)) - 1/(Math.sqrt(price))
    let deltaX = oneOverDeltaP * L
    let deltaY = deltaP * L
    let Lx2 = amountX + deltaX
    let Ly2 = amountY + deltaY
    let newAssetValue = Lx2 * newPrice + Ly2
    return {newAssetValue,Lx2,Ly2}
}

const chart_opt_with_param = (day,data) => {
        
    return {
        "animation": true,
        "animationThreshold": 2000,
        "animationDuration": 1000,
        "animationEasing": "cubicOut",
        "animationDelay": 0,
        "animationDurationUpdate": 300,
        "animationEasingUpdate": "cubicOut",
        "animationDelayUpdate": 0,
        title: {
            text: `Day ${day}`
        },
        xAxis: {
            type: 'category',
            boundaryGap: false
        },
        yAxis: {
            type: 'value',
            boundaryGap: [0, '30%']
        },
        visualMap: {
            type: 'piecewise',
            show: false,
            dimension: 0,
            seriesIndex: 0,
            pieces:below_zero
        },
        "series": [
            {
                type: 'line',
                smooth: 0.6,
                symbol: 'none',
                lineStyle: {
                    color: '#5470C6',
                    width: 5
                },
                markLine: {
                    symbol: ['none', 'none'],
                    label: { formatter: 'Liquidate' },
                    data: below_zero_line
                },
                
                areaStyle: {},
                "data": data,
                "label": {
                    "show": false,
                    "position": "top",
                    "margin": 8
                }
            }
        ],
    
        tooltip: {
            trigger: 'axis'
        },
    }       
}

const simulate = (cnt=0) => {
    if(!chart_d){
        chart_d = echarts.init(document.getElementById('assetchart'), 'white', {renderer: 'canvas'})
    }
    // do simulate
    let initCapital = 10000
    let cprice_matic = 0.89
    let USD_Price = 1
    let hedgeRatio = 0.05 // 做空比率，0.7代表留了30%的上漲空間
    let miningRatio = 0.6 // 拿來做 uniswap LP 比率，增加部位中性程度


    let upper = 1.1
    let lower = 0.81
    let fee_rate = 0.3
    let initTVL = 7.5 * 1000000
    let range_perc = 0 // 預設1%越寬越少推估的
    

    const sliders = document.getElementsByClassName("range__slider")
	for (let i = 0; i < sliders.length; i++){
		let sld = sliders[i]
        const sliderValue = sld.querySelector(".length__title")
        let sliders_txt = sld.getElementsByClassName("length__title")
        let sldtitle = sliders_txt[0].innerText
        if(sldtitle.includes('Upper Percentage') ){
            upper = cprice_matic * (1 + sld.querySelector("input").value*0.01)
            range_perc = sld.querySelector("input").value
        }else if(sldtitle.includes('Lower Percentage') ){
            lower = cprice_matic * (1 - sld.querySelector("input").value*0.01)
        }else if(sldtitle.includes('Borrow Ratio')){
            hedgeRatio = sld.querySelector("input").value*0.01
        }else if(sldtitle.includes('LP Amount Ratio')){
            miningRatio = sld.querySelector("input").value*0.01
        }
    }
    
    

    const input_txt = document.getElementsByClassName("inputbox")
    for (let i = 0; i < input_txt.length; i++){
        let inp = input_txt[i]
        let title = inp.getElementsByClassName('field-title')[0].innerText
        if(title.includes('Initial')){
            initCapital = inp.getElementsByClassName('result__viewbox')[0].value
        }else if(title.includes('Current')){
            cprice_matic = inp.getElementsByClassName('result__viewbox')[0].value
        }
    }

    // check input parameters
    // console.log(`upper ${upper}`);
    // console.log(`lower ${lower}`);
    // console.log(`hedgeRatio ${hedgeRatio}`);
    // console.log(`miningRatio ${miningRatio}`);
    // console.log(`initCapital ${initCapital}`);
    // console.log(`initialPrice ${initialPrice}`);
    
    scatter_points = []
    below_zero = [] // start below zero price till chart end
    below_zero_line = []

    // 一開始借幣數量
    let hedgeUSDAmt = initCapital * hedgeRatio
    // 借來的顆數
    let shortAmt = hedgeUSDAmt/cprice_matic
    // 借來的顆數實際拿下去作市的數量
    let miningAmt = shortAmt*miningRatio
    // 借來的，持幣不參與作市
    let longAmt = shortAmt - miningAmt 
    let mining_usd_amt = miningAmt * cprice_matic
    // AAVE 清算線
    let liquidation_price = cprice_matic * (2.0-hedgeRatio)

    // 預設1%越寬越少推估的
    const fee_rate_estimated_1 = 0.001915 * cnt / range_perc * miningAmt

    let inkd = getTokenAmountsFromDepositAmounts(cprice_matic, lower, upper, cprice_matic, 1, mining_usd_amt)
    let deltaX = inkd.deltaX
    let deltaY = inkd.deltaY
    let rawLq = calcLiquidity(initialPrice,upper,lower,deltaX,deltaY)

    let tick = 0.01
    let start_price = lower*0.5
    let end_price = liquidation_price * 1.1
    let num_steps = parseInt((end_price-start_price)/tick)
    
    let start_lose_money_point = -1
    let liquidation_point = -1
    let entry_price = -1
    for(let k = 1;k<num_steps;k++){
        let P = start_price + tick * k
        //當前經過 IL 計算之後部位剩餘顆數
        let P_clamp = Math.min( Math.max(P,lower),upper)
        let rawlpc = getILPriceChange(cprice_matic,P_clamp,upper,lower,deltaX,deltaY)
        let amt1 = rawlpc.Lx2
        let amt2 = rawlpc.Ly2
        curamt = amt1+amt2/P + longAmt
        let hedged_res = initCapital - (shortAmt - curamt)*P
        hedged_res += fee_rate_estimated_1
        scatter_points.push([P.toFixed(3),hedged_res])
        
        if(start_lose_money_point<0){
            if(hedged_res<=initCapital){
                start_lose_money_point = k-1
            }
        }
        if(liquidation_point<0){
            if(P>=liquidation_price){
                liquidation_point = k-1
            }
        }
        if(entry_price<0){
            if(P>=cprice_matic){
                entry_price = k-1
            }
        }
        
    }

    
    below_zero.push(
        {
            gt: liquidation_point,
            lt: num_steps,
            color: 'rgba(255, 0, 0, 0.4)'
        },
        {
            gt: start_lose_money_point,
            lt: liquidation_point,
            color: 'rgba(0, 0, 180, 0.4)'
        },
    
    )
    below_zero_line.push(
        {
            name: 'liquidate',
            xAxis:liquidation_point,
            label: { 
                formatter: 'liquidate',
            },
        },
        {
            name: 'entryPrice',
            xAxis:entry_price,
            label: { 
                formatter: 'entryPrice',
            },
        }
    )
    
}

const toggleChartData = (cnt) => {
    simulate(cnt)
    console.log(cnt);
    let opt1 = chart_opt_with_param(cnt,scatter_points)
    chart_d.setOption(opt1)
}