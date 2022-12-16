var chart_d = null
var scatter_points = []

var profitlow = 0
var profithigh = -99999999999
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

const chart_opt_with_param = (xTitle,yTitle,zTitle,data,profitlow,profithigh) => {
        
    return {
    "animation": true,
    "animationThreshold": 2000,
    "animationDuration": 1000,
    "animationEasing": "cubicOut",
    "animationDelay": 0,
    "animationDurationUpdate": 300,
    "animationEasingUpdate": "cubicOut",
    "animationDelayUpdate": 0,
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
        pieces: [
          {
            gt: 1,
            lt: 3,
            color: 'rgba(0, 0, 180, 0.4)'
          },
          {
            gt: 5,
            lt: 7,
            color: 'rgba(0, 0, 180, 0.4)'
          }
        ]
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
                label: { show: false },
                data: [{ xAxis: 1 }, { xAxis: 3 }]
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


    }
}

const simulate = () => {
    if(!chart_d){
        chart_d = echarts.init(document.getElementById('assetchart'), 'white', {renderer: 'canvas'})
    }
    // do simulate
    let initialCapital = 10000
    let initialPrice = 0.89
    let USD_Price = 1
    let hedgeRatio = 0.05 // 做空比率，0.7代表留了30%的上漲空間
    let miningRatio = 0.6 // 拿來做 uniswap LP 比率，增加部位中性程度


    let upper = 1.1
    let lower = 0.81
    let fee_rate = 0.3
    let initTVL = 159.27 * 1000000
    let TVLGrowRate = 0.05
    
    
    const sliders = document.getElementsByClassName("range__slider")
	for (let i = 0; i < sliders.length; i++){
		let sld = sliders[i]
        const sliderValue = sld.querySelector(".length__title")
        let sliders_txt = sld.getElementsByClassName("length__title")
        let sldtitle = sliders_txt[0].innerText
        if(sldtitle.includes('Upper Percentage') ){
            upper = initialPrice * (1 + sld.querySelector("input").value*0.01)
        }else if(sldtitle.includes('Lower Percentage') ){
            lower = initialPrice * (1 - sld.querySelector("input").value*0.01)
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
            initialCapital = inp.getElementsByClassName('result__viewbox')[0].value
        }else if(title.includes('Current')){
            initialPrice = inp.getElementsByClassName('result__viewbox')[0].value
        }
    }

    // check input parameters
    // console.log(`upper ${upper}`);
    // console.log(`lower ${lower}`);
    // console.log(`hedgeRatio ${hedgeRatio}`);
    // console.log(`miningRatio ${miningRatio}`);
    // console.log(`initialCapital ${initialCapital}`);
    // console.log(`initialPrice ${initialPrice}`);
    
    scatter_points = []
    below_zero = [{ xAxis: 1 }, { xAxis: 3 }] // start price end

    let rwkd = getTokenAmountsFromDepositAmounts(initialPrice,lower,upper,initialPrice,USD_Price,initialCapital)
    let rawAmtEth = rwkd.deltaX
    let rawAmtUsd = rwkd.deltaY
    let rawLq = calcLiquidity(initialPrice,upper,lower,rawAmtEth,rawAmtUsd)

    let poolAsset = initialCapital - (initialCapital*hedgeRatio)
    let inkd = getTokenAmountsFromDepositAmounts(initialPrice,lower,upper,initialPrice,USD_Price,poolAsset)
    let initialAmtEth = inkd.deltaX
    let initialAmtUsd = inkd.deltaY
    
    return
    for(let k = 1;k<initialPrice*2;k+=50){
        let feeIncome_raw_accu = 0
        let feeIncome_accu = 0
        let fundrate_income_accu = 0
        
        let curp = k
        if(k>upper)
            curp = upper
        
        let rawlpc = getILPriceChange(initialPrice,curp,upper,lower,rawAmtEth,rawAmtUsd)
        let rawIL = rawlpc.newAssetValue
        if(rawIL<0)
            rawIL=0
        scatter_points.push([d,k,rawIL])


        let nthDay_tvl = initTVL * (1+TVLGrowRate/30*d)
        let rand = Math.random()
        let todayVolEstimation = tradevol_lower + rand * (tradevol_upper - tradevol_lower)
        
        let feeIncome_rw = (rawLq / nthDay_tvl) * todayVolEstimation * (1+TVLGrowRate/30*d) * fee_rate * 0.01
        feeIncome_raw_accu += feeIncome_rw

        let rawIL_fee = rawIL + feeIncome_raw_accu
        


        let ilpc = getILPriceChange(initialPrice,curp,upper,lower,initialAmtEth,initialAmtUsd)
        let newAssetValue = ilpc.newAssetValue
        if(newAssetValue<0)
            newAssetValue=0
        
        let hedge_price = initialPrice
        let h_eth = (initialCapital*hedge_rto) / initialPrice
        const max_lvg = 10
        let _lvg = (1 - hedge_rto) / hedge_rto
        if(_lvg>max_lvg){
            _lvg = max_lvg
        }
        let nominalSz = _lvg*h_eth
        let uPnL = Math.max( h_eth*hedge_price + (hedge_price - k) * nominalSz , 0 )
        

        let hedged_asset = newAssetValue + uPnL + fundrate_income_accu
        
        let curCapital = hedged_asset + feeIncome_accu
        scatter_points.push([d,k,curCapital])

        //console.log(`day ${d} price${k} asset=${newAssetValue} fee ${feeIncome_accu} heg ${(uPnL+fundrate_income_accu)} total ${curCapital}` )

        
        if(rawIL_fee>profithigh){
            profithigh=rawIL_fee
        }
        if(newAssetValue>profithigh){
            profithigh=newAssetValue
        }
        if(curCapital>profithigh){
            profithigh=curCapital
        }
    }
}

const toggleChartData = () => {
    simulate()
    let opt1 = chart_opt_with_param("Day","Price","Asset Value",scatter_points,profitlow,profithigh)
    chart_d.setOption(opt1)
}