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
    let upper = 1.1
    let lower = 0.81
    let fee_rate = 0.3
    let initTVL = 159.27 * 1000000
    let TVLGrowRate = 0.05
    let tradevol_upper = 6000.59 * 1000000
    let tradevol_lower = 551.57 * 1000000
    let hedge_rto = 0.05
    let fundrate_upper = 0.03*0.01*3
    let fundrate_lower = 0.01*0.01*3
    
    const sliders_txt = document.getElementsByClassName("length__title")
    for (let i = 0; i < sliders_txt.length; i++){
        let sld = sliders_txt[i]
        if(sld.innerText.includes('Upper Price') ){
            upper = parseFloat(sld.parentElement.getElementsByClassName('slider')[0].value)
        }else if(sld.innerText.includes('Lower Price') ){
            lower = parseFloat(sld.parentElement.getElementsByClassName('slider')[0].value)
        }else if(sld.innerText.includes('Hedge Ratio')){
            let short_ratio = parseFloat(sld.parentElement.getElementsByClassName('slider')[0].value)
            hedge_rto = short_ratio*0.01
        }
    }
    
    const input_txt = document.getElementsByClassName("inputbox")
    for (let i = 0; i < input_txt.length; i++){
        let inp = input_txt[i]
        let title = inp.getElementsByClassName('field-title')[0].innerText
        if(title==='Initial Capital'){
            initialCapital = parseFloat(inp.getElementsByClassName('result__viewbox')[0].getAttribute('value'))
        }else if(title==='Initial Capital'){
            initialPrice = parseFloat(inp.getElementsByClassName('result__viewbox')[0].getAttribute('value'))
        }
    }
    
    scatter_points = []
    below_zero = [{ xAxis: 1 }, { xAxis: 3 }] // start price end

    let rwkd = getTokenAmountsFromDepositAmounts(initialPrice,lower,upper,initialPrice,USD_Price,initialCapital)
    let rawAmtEth = rwkd.deltaX
    let rawAmtUsd = rwkd.deltaY
    let rawLq = calcLiquidity(initialPrice,upper,lower,rawAmtEth,rawAmtUsd)

    let poolAsset = initialCapital - (initialCapital*hedge_rto)
    let inkd = getTokenAmountsFromDepositAmounts(initialPrice,lower,upper,initialPrice,USD_Price,poolAsset)
    let initialAmtEth = inkd.deltaX
    let initialAmtUsd = inkd.deltaY
    let initialLq = calcLiquidity(initialPrice,upper,lower,initialAmtEth,initialAmtUsd)
    
    
    
    for(let k = 1;k<initialPrice*2;k+=50){
        let feeIncome_raw_accu = 0
        let feeIncome_accu = 0
        let fundrate_income_accu = 0
        for(let d = 1;d<366;d+=5){
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
            let fundrate = fundrate_lower + rand * (fundrate_upper - fundrate_lower)
            let fundrate_income = 0
            if(uPnL>0.001){
                fundrate_income =  h_eth * fundrate * hedge_price
                fundrate_income_accu += fundrate_income
            }

            let hedged_asset = newAssetValue + uPnL + fundrate_income_accu
            
            
            let feeIncome = (initialLq / nthDay_tvl) * todayVolEstimation * (1+TVLGrowRate/30*d) * fee_rate * 0.01
            feeIncome_accu += feeIncome

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
}

const toggleChartData = () => {
    simulate()
    let opt1 = chart_opt_with_param("Day","Price","Asset Value",scatter_points,profitlow,profithigh)
    chart_d.setOption(opt1)
}