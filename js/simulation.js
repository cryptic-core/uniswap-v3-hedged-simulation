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

const simulate = (cnt=0,hedgetype="noHedge") => {
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
        }else if(sldtitle.includes('Short Ratio')){
            hedgeRatio = sld.querySelector("input").value*0.01
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

    // 實際拿下去作市的數量
    let mining_usd_amt = initCapital*(1-hedgeRatio)
    let hedge_usd_amt = initCapital - mining_usd_amt
    
    // 預設1%越寬越少推估的
    const fee_rate_estimated_1 = 0.001915 * cnt / range_perc * mining_usd_amt * 10

    let inkd = getTokenAmountsFromDepositAmounts(cprice_matic, lower, upper, cprice_matic, 1, mining_usd_amt)
    let deltaX = inkd.deltaX
    let deltaY = inkd.deltaY
    let rawLq = calcLiquidity(initialPrice,upper,lower,deltaX,deltaY)

    let tick = 0.01
    let start_price = lower*0.5
    let end_price = upper * 1.5
    let num_steps = parseInt((end_price-start_price)/tick)
    
    let start_lose_money_point = -1
    let liquidation_point = -1
    let entry_price = -1
    for(let k = 1;k<num_steps;k++){
        let P = start_price + tick * k
        //當前經過 IL 計算之後部位剩餘顆數
        let P_clamp = Math.min( Math.max(P,lower),upper)
        let rawlpc = getILPriceChange(cprice_matic,P_clamp,upper,lower,deltaX,deltaY)
        let _res = rawlpc.newAssetValue
        if(P<upper){
            _res =rawlpc.Ly2 + rawlpc.Lx2 * P
        }
        _res += fee_rate_estimated_1
        console.log(`${_res} + ${fee_rate_estimated_1}`);
        switch(hedgetype){
            case "noHedge":{
                _res += hedge_usd_amt
                if(start_lose_money_point<0){
                    if(_res>initCapital){
                        start_lose_money_point = k-1
                    }
                }
            }break;
            case "futureHedge":{
            }break;
        }
        scatter_points.push([P.toFixed(3),_res])
    }


    switch(hedgetype){
        case "noHedge":{
            below_zero.push(
                {
                    gt: 0,
                    lt: start_lose_money_point,
                    color: 'rgba(0, 0, 180, 0.4)'
                },
            )
        }break;
        case "futureHedge":{
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
        }break;
        
    }
    
}


const toggleChartData = (cnt,hedgetype="noHedge") => {
    simulate(cnt,hedgetype)
    let opt1 = chart_opt_with_param(cnt,scatter_points)
    chart_d.setOption(opt1)
}