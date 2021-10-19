const scheduler = window.scheduler

const moreImportantTask = (timer) => {
    setTimeout(()=>{
        console.log(`执行更重要的任务 timeout:${timer}`)
    },timer)
}

const longtimeTask = (label) => {
    const startTime = scheduler.unstable_now()
    // 调整 times 来调整单个任务运行时长
    let times = 10000000
    let scores = 0
    while(times--){
        scores++
    }
    const endTime = scheduler.unstable_now()
    console.log(`${label} : single task cost time ${endTime-startTime}`)
    return scores
}

const task = (name) => {
    const subtask4 = () => {
        longtimeTask(`${name}-subtask4`)
    }
    const subtask3 = () => {
        longtimeTask(`${name}-subtask3`)
        return subtask4
    }
    const subtask2 = () => {
        longtimeTask(`${name}-subtask2`)
        return subtask3
    }
    const subtask1 = () => {
        longtimeTask(`${name}-subtask1`)
        return subtask2
    }
    return subtask1
}

const {
  unstable_ImmediatePriority,
  unstable_UserBlockingPriority,
  unstable_NormalPriority,
  unstable_LowPriority,
  unstable_IdlePriority,
} = scheduler

scheduler.unstable_scheduleCallback(unstable_ImmediatePriority, task('task1'))
scheduler.unstable_scheduleCallback(unstable_UserBlockingPriority, task('task2'))
scheduler.unstable_scheduleCallback(unstable_NormalPriority, task('task3'))
scheduler.unstable_scheduleCallback(unstable_LowPriority, task('task4'))
scheduler.unstable_scheduleCallback(unstable_IdlePriority, task('task4'))

moreImportantTask(0)
moreImportantTask(10)
moreImportantTask(20)
moreImportantTask(50)
moreImportantTask(100)
moreImportantTask(110)
moreImportantTask(120)
moreImportantTask(150)
moreImportantTask(200)